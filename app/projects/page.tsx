'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { files } from './files';

const Projects = () => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const terminalRef = useRef<HTMLDivElement>(null);
    const webcontainerRef = useRef<any>(null);

    const writeIndexJS = async (content: string) => {
        if (webcontainerRef.current) {
            await webcontainerRef.current.fs.writeFile('/src/App.jsx', content);
        }
    };

    const startShell = async (terminal: any) => {
        if (!webcontainerRef.current) return;

        const shellProcess = await webcontainerRef.current.spawn('jsh', {
            terminal: {
                cols: terminal.cols,
                rows: terminal.rows,
            },
        });

        shellProcess.output.pipeTo(
            new WritableStream({
                write(data) {
                    terminal.write(data);
                },
            })
        );

        const input = shellProcess.input.getWriter();
        terminal.onData((data: string) => {
            input.write(data);
        });

        return shellProcess;
    };

    const installDependencies = async (terminal: any) => {
        // Install dependencies
        const installProcess = await webcontainerRef.current.spawn('npm', ['install']);

        installProcess.output.pipeTo(new WritableStream({
            write(data) {
                terminal.write(data);
            }
        }));
        // Wait for install command to exit
        return installProcess.exit;
    };

    const startDevServer = async (terminal: any) => {
        // Start the dev server
        const devProcess = await webcontainerRef.current.spawn('npm', ['run', 'dev']);

        devProcess.output.pipeTo(new WritableStream({
            write(data) {
                terminal.write(data);
            }
        }));

        // Wait for dev server to be ready
        webcontainerRef.current.on('server-ready', (port: number, url: string) => {
            iframeRef.current!.src = url;
        });
    };

    useEffect(() => {
        let terminal: any;
        let shellProcess: any;

        const initializeWebContainer = async () => {
            if (!terminalRef.current) return;

            // 动态导入需要的模块
            const { WebContainer } = await import('@webcontainer/api');
            const { Terminal } = await import('@xterm/xterm');
            const { FitAddon } = await import('@xterm/addon-fit');

            // 导入 CSS
            await import('@xterm/xterm/css/xterm.css' as string);

            const fitAddon = new FitAddon();
            terminal = new Terminal({
                convertEol: true,
            });

            terminal.loadAddon(fitAddon);
            terminal.open(terminalRef.current);
            fitAddon.fit();

            // Initialize WebContainer
            webcontainerRef.current = await WebContainer.boot();
            await webcontainerRef.current.mount(files);

            // Set up event listener for server-ready
            webcontainerRef.current.on('server-ready', (port: number, url: string) => {
                if (iframeRef.current) {
                    iframeRef.current.src = url;
                }
            });

            // Install dependencies first
            await installDependencies(terminal);
            
            // Start dev server
            await startDevServer(terminal);

            // Start shell
            shellProcess = await startShell(terminal);

            // Handle resize
            const handleResize = () => {
                fitAddon.fit();
                shellProcess?.resize({
                    cols: terminal.cols,
                    rows: terminal.rows,
                });
            };

            window.addEventListener('resize', handleResize);

            // Set up textarea event listener
            if (textareaRef.current) {
                textareaRef.current.value = files['src'].directory['App.jsx'].file.contents;
                textareaRef.current.addEventListener('input', async (e) => {
                    const target = e.target as HTMLTextAreaElement;
                    if (webcontainerRef.current) {
                        await webcontainerRef.current.fs.writeFile('/src/App.jsx', target.value);
                    }
                });
            }

            return () => {
                window.removeEventListener('resize', handleResize);
                terminal.dispose();
            };
        };

        initializeWebContainer();

        return () => {
            terminal?.dispose();
        };
    }, []);

    return (
        <div className="container w-screen">
            <div className='flex w-full'>
                <div className="editor flex-1 h-full">
                    <textarea
                        ref={textareaRef}
                        className='h-96 w-full resize-none rounded border border-gray-300 p-2 focus:outline-none'
                        defaultValue="I am a textarea"
                        spellCheck="false"
                        placeholder="Enter your code here..."
                    />
                </div>


                <div className="preview border-2 flex-1 h-full">
                    <iframe
                        className="w-full h-96 min-w-96"
                        ref={iframeRef}
                        src="/loading.html"
                        title="Preview"
                    />
                </div>
            </div>


            <div className="terminal w-full h-80 overflow-auto">
                <div ref={terminalRef} />
            </div>
        </div>
    );
};

// 使用 dynamic 导入组件，并禁用 SSR
export default dynamic(() => Promise.resolve(Projects), {
    ssr: false
});