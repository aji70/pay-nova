import { cookieStorage, createStorage, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, celo, base, sepolia, arbitrum, baseSepolia } from '@reown/appkit/networks'

// Get projectId from https://dashboard.reown.com
// export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
export const projectId = '912f9a3279905a7dd417a7bf68e04209'

if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const networks = [mainnet, celo, base, sepolia, arbitrum, baseSepolia]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig