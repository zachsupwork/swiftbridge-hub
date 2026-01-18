import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, DollarSign, Download, Calendar } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { getAnalytics, exportToCSV, getSwapHistory } from '@/lib/swapStorage';
import { getIntegratorFee, formatFeePercentage } from '@/lib/lifiClient';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Analytics() {
  const [timeRange, setTimeRange] = useState(30);
  
  const analytics = useMemo(() => getAnalytics(timeRange), [timeRange]);
  const history = getSwapHistory();
  const integratorFee = getIntegratorFee();

  const handleExport = () => {
    const csv = exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swiftswap-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    {
      label: 'Total Swaps',
      value: analytics.totalSwaps.toString(),
      icon: BarChart3,
      color: 'text-primary',
    },
    {
      label: 'Completed',
      value: analytics.completedSwaps.toString(),
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      label: 'Volume (USD)',
      value: `$${analytics.totalVolumeUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: 'text-secondary',
    },
    {
      label: `Fees Earned (${formatFeePercentage(integratorFee)})`,
      value: `$${analytics.earnedFeesUSD.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-warning',
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Analytics</h1>
              <p className="text-muted-foreground">
                Track your swap history and earned fees
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Time range selector */}
              <div className="flex items-center gap-1 glass rounded-lg p-1">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeRange(days)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      timeRange === days
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="glass rounded-xl p-6"
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  {stat.label}
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Volume chart */}
            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Daily Volume</h3>
              <div className="h-64">
                {analytics.dailyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.dailyStats}>
                      <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 20%)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: 'hsl(215, 20%, 65%)' }}
                        tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'hsl(215, 20%, 65%)' }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(222, 47%, 10%)',
                          border: '1px solid hsl(217, 33%, 20%)',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="volume"
                        stroke="hsl(199, 89%, 48%)"
                        fillOpacity={1}
                        fill="url(#volumeGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Fees chart */}
            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Daily Fees Earned</h3>
              <div className="h-64">
                {analytics.dailyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 20%)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: 'hsl(215, 20%, 65%)' }}
                        tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'hsl(215, 20%, 65%)' }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(222, 47%, 10%)',
                          border: '1px solid hsl(217, 33%, 20%)',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
                      />
                      <Bar
                        dataKey="fees"
                        fill="hsl(38, 92%, 50%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent transactions */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Recent Transactions</h3>
            </div>
            {history.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">Complete a swap to see it here</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {history.slice(0, 10).map((swap) => (
                  <div key={swap.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium">
                        {swap.fromToken} → {swap.toToken}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(swap.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${swap.fromAmountUSD}</div>
                      <div className={`text-xs px-2 py-0.5 rounded-full ${
                        swap.status === 'completed'
                          ? 'bg-success/20 text-success'
                          : swap.status === 'failed'
                          ? 'bg-destructive/20 text-destructive'
                          : 'bg-warning/20 text-warning'
                      }`}>
                        {swap.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
