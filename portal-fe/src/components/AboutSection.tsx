import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { GraphStats } from '../types/graph';
import { CATEGORY_LABELS, type Category } from '../types/index';
import './AboutSection.css';

interface AboutSectionProps {
  stats: GraphStats;
}

export default function AboutSection({ stats }: AboutSectionProps) {
  const radarData = Object.entries(stats.byCategory)
    .map(([cat, count]) => ({
      subject: CATEGORY_LABELS[cat as Category] ?? cat,
      value: count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <section id="about" className="about-section">
      <div className="about-inner">
        <div className="about-content">
          <div className="about-profile">
            <div className="about-open-badge">
              <span className="about-pulse-dot" />
              OPEN TO WORK
            </div>
            <h2 className="about-name">Gideok Kwon</h2>
            <p className="about-title">Backend Engineer</p>
            <p className="about-oneliner">
              MSA + Clean Architecture 기반 커머스 플랫폼을 설계하고 구현합니다
            </p>
            <div className="about-links">
              <a
                className="about-link"
                href="https://www.linkedin.com/in/gideok-kwon-57531b2a9/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <LinkedInIcon />
                LinkedIn
              </a>
              <a
                className="about-link"
                href="https://github.com/1989v/msa"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubIcon />
                GitHub
              </a>
              <a className="about-link" href="mailto:1989v@naver.com">
                <EmailIcon />
                1989v@naver.com
              </a>
            </div>
          </div>

          <div className="about-radar">
            <h3 className="about-radar-title">Tech Radar</h3>
            <p className="about-radar-subtitle">카테고리별 코드 참조 분포</p>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="rgba(108,99,255,0.2)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <Radar
                  name="Count"
                  dataKey="value"
                  stroke="#6c63ff"
                  fill="#6c63ff"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(13,13,26,0.95)',
                    border: '1px solid rgba(108,99,255,0.3)',
                    borderRadius: 8,
                    color: '#e0e0e0',
                    fontSize: '0.8125rem',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
