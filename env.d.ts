// env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_PAYNOVA_CONTRACT: `0x${string}`;
    NEXT_PUBLIC_USDT_BASE_SEPOLIA: `0x${string}`;
    NEXT_PUBLIC_USDC_BASE_SEPOLIA: `0x${string}`;
    NEXT_PUBLIC_USDT_ETHEREUM: `0x${string}`;
    NEXT_PUBLIC_USDC_ETHEREUM: `0x${string}`;
    NEXT_PUBLIC_USDT_BSC: `0x${string}`;
    NEXT_PUBLIC_USDC_BSC: `0x${string}`;
  }
}