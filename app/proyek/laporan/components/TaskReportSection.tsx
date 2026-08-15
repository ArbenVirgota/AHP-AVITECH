// app/proyek/laporan/components/TaskReportSection.tsx

import React from 'react';
import { formatNumber } from '../helpers/ahp';
import type { TaskReport } from '../helpers/report-types';
import { reportStyles as styles } from '../helpers/report-styles';
import MatrixTable from './MatrixTable';

interface TaskReportSectionProps {
  report: TaskReport;
}

export default function TaskReportSection({
  report,
}: TaskReportSectionProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.sectionTitle}>{report.task.title}</h2>
      <p style={styles.metaText}>{report.task.description}</p>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Item</th>
              <th style={styles.th}>Bobot agregat</th>
            </tr>
          </thead>
          <tbody>
            {report.aggregatedWeights.map((item) => (
              <tr key={item.name}>
                <td style={styles.tdHead}>{item.name}</td>
                <td style={styles.td}>{formatNumber(item.weight, 6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.expertReports.map((item) => (
        <div
          key={`${report.task.key}-${item.expert.id}`}
          style={styles.expertBlock}
        >
          <div style={styles.expertHeader}>
            <div>
              <h3 style={styles.subTitle}>{item.expert.expertname}</h3>
              <p style={styles.metaText}>{item.expert.asalinstansi || '-'}</p>
            </div>

            <div style={styles.crPill}>
              CR: {formatNumber(item.latestAnalysis.cr, 4)} ·{' '}
              {item.latestAnalysis.cr <= 0.1
                ? 'Konsisten'
                : 'Perlu tinjauan'}
            </div>
          </div>

          <div style={styles.gridTwo}>
            <MatrixTable
              labels={report.task.itemnames}
              matrix={item.baselineMatrix}
              title="Baseline Matrix"
            />
            <MatrixTable
              labels={report.task.itemnames}
              matrix={item.latestMatrix}
              title="Latest Matrix"
            />
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Bobot prioritas</th>
                </tr>
              </thead>
              <tbody>
                {report.task.itemnames.map((label, idx) => (
                  <tr key={label}>
                    <td style={styles.tdHead}>{label}</td>
                    <td style={styles.td}>
                      {formatNumber(item.latestAnalysis.weights[idx] || 0, 6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}