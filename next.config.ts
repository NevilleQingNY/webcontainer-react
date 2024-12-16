import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    typescript: {
        // 允许在存在 TypeScript 错误的情况下完成生产构建
        ignoreBuildErrors: true,
    },
    // 如果还想忽略 ESLint 错误
    eslint: {
        ignoreDuringBuilds: true,
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'require-corp',
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                ],
            },
        ];
    },
    webpack: (config, { isServer }) => {
        // 避免服务端打包这些模块
        if (isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                '@webcontainer/api': false,
                '@xterm/xterm': false,
                '@xterm/addon-fit': false,
            };
        }
        return config;
    },
};

export default nextConfig;
