import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { GraphStats } from '../../types/graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface StatsDashboardProps {
  stats: GraphStats;
}

export default function StatsDashboard({ stats }: StatsDashboardProps) {
  const categoryData = Object.entries(stats.byCategory).map(([key, value]) => ({
    name: CATEGORY_LABELS[key as Category] || key,
    count: value,
    color: CATEGORY_COLORS[key as Category] || '#94a3b8',
  }));

  const levelData = Object.entries(stats.byLevel).map(([key, value]) => ({
    name: key,
    value,
  }));

  const levelColors = ['#00b894', '#fdcb6e', '#e17055'];

  return (
    <div style={{ padding: 32, height: '100%', overflow: 'auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: '1.125rem', marginBottom: 24, textAlign: 'center' }}>Statistics</h2>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginBottom: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#6c63ff' }}>{stats.totalConcepts}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Concepts</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#4ecdc4' }}>{stats.totalIndexes}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Code Indexes</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#ffd93d' }}>{Object.keys(stats.byCategory).length}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Categories</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ flex: '1 1 350px', maxWidth: 500 }}>
          <h3 style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: 12 }}>By Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" stroke="#444" />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize="0.625rem" width={80} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #334155', color: '#e0e0e0' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: '0 0 200px' }}>
          <h3 style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: 12 }}>By Level</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={levelData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name }) => name}>
                {levelData.map((_, i) => (
                  <Cell key={i} fill={levelColors[i % levelColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #334155', color: '#e0e0e0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
