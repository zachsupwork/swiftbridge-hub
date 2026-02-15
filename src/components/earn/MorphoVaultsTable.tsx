/**
 * Morpho Vaults Table Component
 * 
 * Displays curated Morpho vaults with deposit/withdraw actions.
 */

import { useState, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ExternalLink,
  Vault,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChainIcon } from '@/components/common/ChainIcon';
import { getMorphoChainConfig } from '@/lib/morpho/config';
import type { MorphoVault, VaultPosition } from '@/lib/morpho/vaultsClient';

interface MorphoVaultsTableProps {
  vaults: MorphoVault[];
  vaultPositions: VaultPosition[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatAPY(apy: number): string {
  if (!Number.isFinite(apy) || apy === 0) return '—';
  if (apy < 0.01) return '<0.01%';
  return `${apy.toFixed(2)}%`;
}

const VaultRow = memo(function VaultRow({ vault, userPosition }: { vault: MorphoVault; userPosition?: VaultPosition }) {
  const chainConfig = getMorphoChainConfig(vault.chainId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 hover:bg-muted/20 transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Vault info */}
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Vault className="w-5 h-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{vault.name}</span>
            {chainConfig && (
              <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px]">
                <ChainIcon chainId={vault.chainId} size="sm" />
                {chainConfig.label}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <span>{vault.asset.symbol}</span>
            {vault.curator && (
              <>
                <span>•</span>
                <span>Curator: {vault.curator}</span>
              </>
            )}
            {vault.marketsCount > 0 && (
              <>
                <span>•</span>
                <span>{vault.marketsCount} market{vault.marketsCount > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">APY</div>
            <div className="font-medium text-success text-sm">{formatAPY(vault.apy)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">TVL</div>
            <div className="font-medium text-sm">{formatUsd(vault.totalAssetsUsd)}</div>
          </div>
          {vault.fee > 0 && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Fee</div>
              <div className="text-sm text-muted-foreground">{vault.fee.toFixed(0)}%</div>
            </div>
          )}
        </div>

        {/* User position */}
        {userPosition && userPosition.assetsUsd > 0 && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Your Deposit</div>
            <div className="font-medium text-sm text-primary">{formatUsd(userPosition.assetsUsd)}</div>
          </div>
        )}

        {/* Link to Morpho app */}
        <a
          href={`https://app.morpho.org/vault?vault=${vault.address}&network=${vault.chainId === 1 ? 'mainnet' : vault.chainId === 8453 ? 'base' : 'mainnet'}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title="Open in Morpho App"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Mobile stats */}
      <div className="sm:hidden flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
        <div>
          <div className="text-xs text-muted-foreground">APY</div>
          <div className="text-sm font-medium text-success">{formatAPY(vault.apy)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">TVL</div>
          <div className="text-sm font-medium">{formatUsd(vault.totalAssetsUsd)}</div>
        </div>
        {userPosition && userPosition.assetsUsd > 0 && (
          <div>
            <div className="text-xs text-muted-foreground">Deposited</div>
            <div className="text-sm font-medium text-primary">{formatUsd(userPosition.assetsUsd)}</div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export function MorphoVaultsTable({
  vaults,
  vaultPositions,
  loading,
  error,
  onRefresh,
}: MorphoVaultsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const positionMap = useMemo(() => {
    const map = new Map<string, VaultPosition>();
    for (const p of vaultPositions) {
      map.set(`${p.chainId}-${p.vaultAddress}`, p);
    }
    return map;
  }, [vaultPositions]);

  const filteredVaults = useMemo(() => {
    if (!searchQuery.trim()) return vaults;
    const q = searchQuery.toLowerCase();
    return vaults.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.symbol.toLowerCase().includes(q) ||
      v.asset.symbol.toLowerCase().includes(q) ||
      (v.curator?.toLowerCase().includes(q))
    );
  }, [vaults, searchQuery]);

  if (loading && vaults.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={`vault-skel-${i}`} className="glass rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && vaults.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">Unable to load vaults</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={onRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    );
  }

  if (vaults.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <Vault className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">No Vaults Found</h3>
        <p className="text-muted-foreground">No Morpho vaults available on this chain.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search vaults..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-muted/30 border-border/50"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {filteredVaults.length} vault{filteredVaults.length !== 1 ? 's' : ''} found
        {loading && <Loader2 className="w-4 h-4 animate-spin inline ml-2" />}
      </p>

      <div className="space-y-2">
        {filteredVaults.map(vault => (
          <VaultRow
            key={`${vault.chainId}-${vault.address}`}
            vault={vault}
            userPosition={positionMap.get(`${vault.chainId}-${vault.address}`)}
          />
        ))}
      </div>
    </div>
  );
}
