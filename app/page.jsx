"use client"

import CarAnimation from "@/components/CarAnimation";
import { ThirdwebProvider, ChainId } from '@thirdweb-dev/react';

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <ThirdwebProvider desiredChainId={ChainId.Goerli}>
        <div id="container">
          <CarAnimation/>
        </div>
      </ThirdwebProvider>
   </main>
  );
}
