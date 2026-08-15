// app/proyek/laporan/components/MatrixTable.tsx

import React from 'react';
import { formatMatrixValue } from '../helpers/ahp';
import { reportStyles as styles } from '../helpers/report-styles';

interface MatrixTableProps {
  labels: string[];
  matrix: number[][];
  title: string;
}

export default function MatrixTable({
  labels,
  matrix,
  title,
}: MatrixTableProps) {
  return (
    <div style={styles.tableCard}>
      <h4 style={styles.tableTitle}>{title}</h4>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Item</th>
              {labels.map((label, idx) => (
                <th key={idx} style={styles.th}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {labels.map((rowLabel, i) => (
              <tr key={i}>
                <td style={styles.tdHead}>{rowLabel}</td>
                {labels.map((_, j) => (
                  <td key={j} style={styles.td}>
                    {i === j ? '1' : formatMatrixValue(matrix[i]?.[j] ?? 1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}