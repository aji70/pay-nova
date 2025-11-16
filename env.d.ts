// env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_PAYNOVA_CONTRACT_BASE: `0x${string}`;
    NEXT_PUBLIC_USDT_BASE: `0x${string}`;
    NEXT_PUBLIC_USDC_BASE: `0x${string}`;
    NEXT_PUBLIC_USDT_ETHEREUM: `0x${string}`;
    NEXT_PUBLIC_USDC_ETHEREUM: `0x${string}`;
    NEXT_PUBLIC_USDT_BSC: `0x${string}`;
    NEXT_PUBLIC_USDC_BSC: `0x${string}`;
  }
}