import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Alchemy network names by chainId
const ALCHEMY_NETWORKS: Record<number, string> = {
  1: "eth-mainnet",
  42161: "arb-mainnet",
  10: "opt-mainnet",
  137: "polygon-mainnet",
  8453: "base-mainnet",
  43114: "avax-mainnet",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ALCHEMY_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ALCHEMY_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { chainId, walletAddress, tokenAddresses } = await req.json();

    if (!chainId || !walletAddress) {
      return new Response(
        JSON.stringify({ error: "chainId and walletAddress required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const network = ALCHEMY_NETWORKS[chainId];
    if (!network) {
      return new Response(
        JSON.stringify({ error: `Chain ${chainId} not supported by Alchemy` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const alchemyUrl = `https://${network}.g.alchemy.com/v2/${apiKey}`;

    // If specific token addresses provided, check those; otherwise get all
    const body: any = {
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getTokenBalances",
      params: tokenAddresses?.length
        ? [walletAddress, tokenAddresses]
        : [walletAddress, "erc20"],
    };

    const resp = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ error: data.error.message || "Alchemy API error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse token balances
    const balances = (data.result?.tokenBalances || [])
      .filter((tb: any) => tb.tokenBalance && tb.tokenBalance !== "0x0" && tb.tokenBalance !== "0x")
      .map((tb: any) => ({
        contractAddress: tb.contractAddress,
        tokenBalance: tb.tokenBalance,
      }));

    // Optionally fetch metadata for non-zero balances
    const enriched = [];
    for (const bal of balances) {
      try {
        const metaResp = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getTokenMetadata",
            params: [bal.contractAddress],
          }),
        });
        const metaData = await metaResp.json();
        const meta = metaData.result || {};
        enriched.push({
          ...bal,
          symbol: meta.symbol || null,
          name: meta.name || null,
          decimals: meta.decimals || null,
          logo: meta.logo || null,
        });
      } catch {
        enriched.push(bal);
      }
    }

    return new Response(
      JSON.stringify({
        chainId,
        walletAddress,
        tokenCount: enriched.length,
        tokens: enriched,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
