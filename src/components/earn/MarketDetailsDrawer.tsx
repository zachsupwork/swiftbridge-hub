/**
 * Market Details Drawer — Full Morpho Spec Sheet
 *
 * Sections:
 *  A) Market Summary (tokens, addresses, LLTV, rates, utilization, liquidity, collateral)
 *  B) Risk + Health Metrics (bad debt placeholders, warnings)
 *  C) Blockchain Transparency (explorer links, copy buttons, contract addresses)
 *  D) Definitions Modal
 *  E) Action Buttons
 *
 * Field definitions:
 *  - Utilization = TotalBorrow / TotalSupply
 *  - Market Liquidity = TotalSupply − TotalBorrow
 *  - Borrow APR = Instant Rate (LOAN asset)
 *  - Supply APY ≈ BorrowAPR × Utilization × (1 − fee)
 *  - Total Market Size = Total Supply in LOAN units + USD
 *
 * Data source: Morpho GraphQL API
 * Known rounding tolerance: ±0.1% on utilization, ±$100 on liquidity
 */

import { useState, useCallback } from 'react';
import {
  Info,
  ExternalLink,
  TrendingUp,
  Wallet,
  HelpCircle,
  Shield,
  Percent,
  Activity,
  Link2,
  Copy,
  Check,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import type { MorphoMarket } from '@/lib/morpho/types';
import { getExplorerAddressUrl } from '@/lib/wagmiConfig';
import { isMarketTrusted } from '@/hooks/useMorphoMarkets';

interface MarketDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  market: MorphoMarket | null;
  onSupply?: () => void;
  onBorrow?: () => void;
}

/* ─── Helpers ─── */
function normalizeAPY(apy: number): number {
  if (!Number.isFinite(apy) || apy === 0) return 0;
  if (apy > 0 && apy <= 1.5) return apy * 100;
  return apy;
}

function formatAPY(apy: number): string {
  const n = normalizeAPY(apy);
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n < 0.01) return '<0.01%';
  return `${n.toFixed(2)}%`;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatTokenAmount(amount: number, symbol: string): string {
  if (!Number.isFinite(amount) || amount === 0) return '—';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M ${symbol}`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K ${symbol}`;
  if (amount >= 1) return `${amount.toFixed(2)} ${symbol}`;
  return `${amount.toFixed(4)} ${symbol}`;
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/* ─── Component ─── */
export function MarketDetailsDrawer({
  isOpen,
  onClose,
  market,
  onSupply,
  onBorrow,
}: MarketDetailsDrawerProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showDefinitions, setShowDefinitions] = useState(false);

  const copy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  if (!market) return null;

  const chainConfig = getMorphoChainConfig(market.chainId);
  const trusted = isMarketTrusted(market);
  const explorer = (chainId: number, addr: string) => getExplorerAddressUrl(chainId, addr);

  const CopyBtn = ({ text, label }: { text: string; label: string }) => (
    <button onClick={() => copy(text, label)} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors" title="Copy">
      {copied === label ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
    </button>
  );

  const AddressRow = ({ label, address }: { label: string; address: string }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <a
          href={explorer(market.chainId, address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-primary hover:underline"
        >
          {truncAddr(address)}
        </a>
        <CopyBtn text={address} label={label} />
        <a href={explorer(market.chainId, address)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-5">
            {/* ─── Header ─── */}
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div>
                  <div className="font-bold text-lg">
                    {market.collateralAsset ? (
                      <>
                        {market.collateralAsset.symbol}
                        <span className="text-muted-foreground font-normal"> / {market.loanAsset.symbol}</span>
                      </>
                    ) : market.loanAsset.symbol}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    {chainConfig?.label || 'Ethereum'}
                    {trusted ? (
                      <Badge variant="outline" className="text-[10px] h-4 bg-success/10 text-success border-success/30 gap-0.5">
                        <Shield className="w-2.5 h-2.5" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-4 bg-warning/10 text-warning border-warning/30 gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Unverified
                      </Badge>
                    )}
                  </div>
                </div>
              </SheetTitle>
              <SheetDescription>Morpho Blue isolated lending market</SheetDescription>
            </SheetHeader>

            {/* ─── Warning Banners ─── */}
            {market.utilization > 95 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span><strong>High utilization ({market.utilization.toFixed(1)}%).</strong> Withdrawals may be limited until borrowers repay.</span>
              </div>
            )}
            {market.availableLiquidityUsd < 10_000 && market.totalSupplyUsd > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span><strong>Low liquidity.</strong> Only {formatUsd(market.availableLiquidityUsd)} available to withdraw.</span>
              </div>
            )}
            {!trusted && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span><strong>Unverified / Higher Risk.</strong> This market contains assets not in our verified allowlist. DYOR.</span>
              </div>
            )}

            {/* ─── Quick Stats ─── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Supply APY
                </div>
                <div className="text-2xl font-bold text-success">{formatAPY(market.supplyApy)}</div>
              </div>
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Wallet className="w-3.5 h-3.5" />
                  Borrow APR
                </div>
                <div className="text-2xl font-bold text-warning">{formatAPY(market.borrowApy)}</div>
              </div>
            </div>

            {/* ─── A) Market Summary ─── */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Market Tokens
              </h3>

              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                {/* Loan Token */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{market.loanAsset.symbol}</div>
                    <div className="text-xs text-muted-foreground">{market.loanAsset.name} • {market.loanAsset.decimals} decimals</div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">Loan Asset</Badge>
                </div>
                <AddressRow label="Address" address={market.loanAsset.address} />
                <div className="text-xs text-muted-foreground">Lenders supply this token to earn interest. Borrowers borrow this token.</div>

                <Separator />

                {/* Collateral Token */}
                {market.collateralAsset ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{market.collateralAsset.symbol}</div>
                        <div className="text-xs text-muted-foreground">{market.collateralAsset.name} • {market.collateralAsset.decimals} decimals</div>
                      </div>
                      <Badge variant="outline" className="bg-secondary/10 text-secondary-foreground border-secondary/30 text-xs">Collateral</Badge>
                    </div>
                    <AddressRow label="Address" address={market.collateralAsset.address} />
                    <div className="text-xs text-muted-foreground">Borrowers deposit this token as collateral to secure loans.</div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No collateral (unsecured market)</div>
                )}
              </div>
            </div>

            {/* ─── Market Metrics ─── */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Market Metrics
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Total Supply" usd={market.totalSupplyUsd} tokenAmount={market.totalSupplyAssets} symbol={market.loanAsset.symbol} />
                <MetricCard label="Total Borrow" usd={market.totalBorrowUsd} tokenAmount={market.totalBorrowAssets} symbol={market.loanAsset.symbol} />
                <MetricCard label="Market Liquidity" usd={market.availableLiquidityUsd} tokenAmount={market.liquidityAssets} symbol={market.loanAsset.symbol} />
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    Utilization
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><HelpCircle className="w-3 h-3" /></TooltipTrigger>
                        <TooltipContent><p className="text-xs max-w-[200px]">Utilization = Total Borrow ÷ Total Supply</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className={cn(
                    "font-semibold",
                    market.utilization > 90 ? "text-destructive" :
                    market.utilization > 70 ? "text-warning" : "text-success"
                  )}>
                    {market.utilization.toFixed(1)}%
                  </div>
                </div>
                {market.totalCollateralUsd > 0 && (
                  <MetricCard label="Total Collateral" usd={market.totalCollateralUsd} />
                )}
                {market.rateAtTarget !== null && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Rate at Target</div>
                    <div className="font-semibold">{market.rateAtTarget.toFixed(2)}%</div>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Protocol Fee</div>
                  <div className="font-semibold">{market.fee.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* ─── Risk Parameters ─── */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />
                Risk Parameters
              </h3>

              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    LLTV (Liquidation LTV)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><HelpCircle className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent><p className="text-xs max-w-[200px]">Maximum loan-to-value ratio. Positions exceeding this are liquidated.</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="font-semibold">{market.lltv.toFixed(1)}%</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bad Debt</span>
                  <span className="text-muted-foreground">—</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Realized Bad Debt</span>
                  <span className="text-muted-foreground">—</span>
                </div>
              </div>
            </div>

            {/* ─── Blockchain Transparency ─── */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                Blockchain Transparency
              </h3>

              <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                {/* Market ID */}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground text-xs">Market ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-foreground">{truncAddr(market.uniqueKey)}</span>
                    <CopyBtn text={market.uniqueKey} label="Market ID" />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground text-xs">Chain ID</span>
                  <span className="text-xs font-medium">{market.chainId}</span>
                </div>
                <AddressRow label="Morpho Blue" address={market.morphoBlue} />
                <AddressRow label="Oracle" address={market.oracle} />
                <AddressRow label="IRM" address={market.irm} />
                <AddressRow label="Loan Token" address={market.loanAsset.address} />
                {market.collateralAsset && (
                  <AddressRow label="Collateral Token" address={market.collateralAsset.address} />
                )}
              </div>

              {/* External links */}
              <div className="flex gap-2">
                <a
                  href={`https://app.morpho.org/market?id=${market.uniqueKey}&network=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    View on Morpho
                  </Button>
                </a>
                <a
                  href={explorer(market.chainId, market.morphoBlue)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    View on Explorer
                  </Button>
                </a>
              </div>
            </div>

            {/* ─── Rate History (placeholder) ─── */}
            <div className="p-4 rounded-lg bg-muted/30 text-center text-xs text-muted-foreground">
              <Activity className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p>Borrow APR & Utilization history charts — coming soon.</p>
            </div>

            {/* ─── How This Market Works ─── */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="w-4 h-4 text-primary" />
                    How this market works
                  </div>
                  <span className="text-xs text-muted-foreground">Toggle</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 rounded-lg bg-muted/30 border border-border/50 text-sm space-y-3">
                <p>
                  <strong>For Lenders:</strong> Supply {market.loanAsset.symbol} to earn {formatAPY(market.supplyApy)} APY.
                  Your funds are lent to borrowers who pay interest.
                </p>
                <p>
                  <strong>For Borrowers:</strong> Deposit {market.collateralAsset?.symbol || 'collateral'} as collateral,
                  then borrow {market.loanAsset.symbol} at {formatAPY(market.borrowApy)} APR.
                </p>
                <p className="text-muted-foreground">
                  This is an isolated lending market. Your supply only goes to THIS market,
                  not spread across multiple markets. Borrowers must maintain a health factor above 1.0
                  or risk liquidation.
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* ─── Definitions ─── */}
            <Collapsible open={showDefinitions} onOpenChange={setShowDefinitions}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Definitions
                  </div>
                  {showDefinitions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 rounded-lg bg-muted/30 border border-border/50 text-xs space-y-3 text-muted-foreground">
                <DefinitionItem term="Utilization" def="Total Borrow ÷ Total Supply. Measures how much of the supplied liquidity is being borrowed." />
                <DefinitionItem term="Market Liquidity" def="Total Supply − Total Borrow. The amount available for withdrawal or new borrows." />
                <DefinitionItem term="Borrow APR" def="The annualized interest rate borrowers pay. This is the 'Instant Rate' on the loan asset." />
                <DefinitionItem term="Supply APY" def="≈ Borrow APR × Utilization × (1 − Protocol Fee). The effective yield lenders earn." />
                <DefinitionItem term="Total Market Size" def="Total Supply in LOAN token units and USD. Represents all assets deposited by lenders." />
                <DefinitionItem term="LLTV" def="Liquidation Loan-To-Value. If a borrower's LTV exceeds this threshold, their collateral is liquidated." />
                <DefinitionItem term="Total Supply / Borrow" def="Shown in LOAN asset units. Collateral amounts are separate and shown in COLLATERAL units." />
                <DefinitionItem term="Rate at Target" def="The IRM's borrow rate at the target utilization point. Used to calibrate the interest rate curve." />
                <DefinitionItem term="Protocol Fee" def="Percentage of borrow interest retained by the protocol. Reduces lender yield." />
              </CollapsibleContent>
            </Collapsible>

            {/* ─── Action Buttons ─── */}
            <div className="flex gap-3">
              <Button
                onClick={() => { onClose(); onSupply?.(); }}
                className="flex-1 gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Supply
              </Button>
              <Button
                variant="outline"
                onClick={() => { onClose(); onBorrow?.(); }}
                className="flex-1 gap-2"
                disabled={!market.collateralAsset}
              >
                <Wallet className="w-4 h-4" />
                Borrow
              </Button>
            </div>

            {/* ─── Disclaimer ─── */}
            <p className="text-xs text-muted-foreground text-center">
              Data from Morpho API. Rates are variable. Smart contract risk applies. No fake data — unavailable fields show "—".
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Sub-components ─── */
function MetricCard({ label, usd, tokenAmount, symbol }: { label: string; usd: number; tokenAmount?: number; symbol?: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-semibold">{formatUsd(usd)}</div>
      {tokenAmount != null && tokenAmount > 0 && symbol && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{formatTokenAmount(tokenAmount, symbol)}</div>
      )}
    </div>
  );
}

function DefinitionItem({ term, def }: { term: string; def: string }) {
  return (
    <div>
      <span className="font-medium text-foreground">{term}:</span>{' '}
      <span>{def}</span>
    </div>
  );
}
