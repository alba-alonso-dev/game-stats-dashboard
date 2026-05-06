// ============================================================
// CompareRadarComponent — Overlapping radar chart for two players.
// IBM DS: Visual comparison across 5 normalised dimensions.
// Axes: Reputation · Notebook · Efficiency · Accuracy · Discretion
// Each value is the player's percentile (0–100) so both players
// are comparable on the same scale regardless of raw units.
// ============================================================
import {
  Component, input, computed,
  ViewChild, ElementRef,
  AfterViewInit, OnChanges, OnDestroy,
  SimpleChanges
} from '@angular/core';
import { PlayerSummary } from '../../../core/models/analytics.model';

const LABELS = ['Reputation', 'Notebook', 'Efficiency', 'Accuracy', 'Discretion'];

// Colours for each player — intentionally distinct
const COLOR_A = {
  bg:     'rgba(200, 149, 42, 0.18)',
  border: 'rgba(200, 149, 42, 0.9)',
  point:  'rgba(232, 184, 75, 1)',
};
const COLOR_B = {
  bg:     'rgba(74, 122, 191, 0.18)',
  border: 'rgba(74, 122, 191, 0.9)',
  point:  'rgba(100, 160, 240, 1)',
};

@Component({
  selector: 'df-compare-radar',
  standalone: true,
  templateUrl: './compare-radar.component.html',
  styleUrls: ['./compare-radar.component.scss']
})
export class CompareRadarComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly playerA = input.required<PlayerSummary>();
  readonly playerB = input.required<PlayerSummary>();

  private chart: any = null;
  private chartReady = false;

  // Map a player summary to 5 percentile-based axis values
  private toRadarData(p: PlayerSummary): number[] {
    return [
      p.percentiles.reputation,
      p.percentiles.notebookCompletion,
      p.percentiles.sessionEfficiency,
      p.percentiles.accuracy,
      // Discretion: inverse of hidden rate percentile-style
      // Higher hidden rate = lower discretion score
      Math.round((1 - p.hiddenDecisionRate) * 100),
    ];
  }

  async ngAfterViewInit(): Promise<void> {
    const {
      Chart, RadarController, RadialLinearScale,
      PointElement, LineElement, Filler, Tooltip, Legend
    } = await import('chart.js');

    Chart.register(
      RadarController, RadialLinearScale,
      PointElement, LineElement, Filler, Tooltip, Legend
    );

    const ctx = this.canvasRef.nativeElement.getContext('2d')!;

    this.chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: LABELS,
        datasets: [
          {
            label:                    this.playerA().name,
            data:                     this.toRadarData(this.playerA()),
            backgroundColor:          COLOR_A.bg,
            borderColor:              COLOR_A.border,
            borderWidth:              2,
            pointBackgroundColor:     COLOR_A.point,
            pointBorderColor:         '#0d0c0a',
            pointHoverBackgroundColor:'#fff',
            pointRadius:              4,
            pointHoverRadius:         6,
          },
          {
            label:                    this.playerB().name,
            data:                     this.toRadarData(this.playerB()),
            backgroundColor:          COLOR_B.bg,
            borderColor:              COLOR_B.border,
            borderWidth:              2,
            pointBackgroundColor:     COLOR_B.point,
            pointBorderColor:         '#0d0c0a',
            pointHoverBackgroundColor:'#fff',
            pointRadius:              4,
            pointHoverRadius:         6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 500, easing: 'easeInOutQuart' },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false, stepSize: 25 },
            grid:       { color: 'rgba(42, 38, 32, 0.8)', lineWidth: 1 },
            angleLines: { color: 'rgba(42, 38, 32, 0.6)' },
            pointLabels: {
              font:  { family: "'JetBrains Mono', monospace", size: 11 },
              color: 'rgba(154, 144, 128, 1)',
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font:    { family: "'JetBrains Mono', monospace", size: 11 },
              color:   'rgba(200, 192, 180, 1)',
              boxWidth: 12, boxHeight: 12, padding: 20,
              usePointStyle: true, pointStyle: 'circle',
            },
          },
          tooltip: {
            backgroundColor: '#1a1814',
            borderColor:     '#2a2620',
            borderWidth: 1,
            titleColor: '#e8e0d0',
            bodyColor:  '#9a9080',
            titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
            bodyFont:  { family: "'JetBrains Mono', monospace", size: 11 },
            callbacks: {
              label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.raw}th percentile`,
            },
          },
        },
      },
    });

    this.chartReady = true;
  }

  // Re-render when inputs change (both players update on swap)
  ngOnChanges(changes: SimpleChanges): void {
    if (!this.chartReady || !this.chart) return;

    if (changes['playerA']) {
      this.chart.data.datasets[0].label = this.playerA().name;
      this.chart.data.datasets[0].data  = this.toRadarData(this.playerA());
    }
    if (changes['playerB']) {
      this.chart.data.datasets[1].label = this.playerB().name;
      this.chart.data.datasets[1].data  = this.toRadarData(this.playerB());
    }

    this.chart.update('active');
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}