import { useCallback, useState } from "react";
import { ethers } from "ethers";

// Sepolia chain id
const SEPOLIA_CHAIN_ID = "0xaa36a7";

export interface WalletState {
  address: string | null;
  connecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    connecting: false,
    error: null,
  });

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setState((s) => ({ ...s, error: "MetaMask not found. Install it to continue." }));
      return null;
    }
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const provider = new ethers.providers.Web3Provider(eth);
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      if (`0x${network.chainId.toString(16)}` !== SEPOLIA_CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchErr) {
          console.warn("[wallet] user did not switch to Sepolia", switchErr);
        }
      }
      const address = accounts[0];
      setState({ address, connecting: false, error: null });
      return address;
    } catch (err: any) {
      setState({ address: null, connecting: false, error: err?.message ?? "Connection failed" });
      return null;
    }
  }, []);

  return { ...state, connect };
}

/** Demo-critical guard: Hunter wallet must differ from the leg's deployer wallet. */
export function isSameWallet(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}
