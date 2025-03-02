"use client"

import CarAnimation from "@/components/CarAnimation";
import { ThirdwebProvider } from "thirdweb/react";

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <ThirdwebProvider >
        <div id="container">
          <CarAnimation/>
        </div>
      </ThirdwebProvider>
   </main>
  );
}
