// ============================================================
// CompareComponent — Side-by-side player comparison.
// Route: /compare/:id1/:id2
// IBM DS: Visual comparison of two player profiles across
// all key metrics — radar chart overlay + metric diff table.
// ============================================================
import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { AnalyticsService } from '../../core/services/analytics.service';
import { PlayerSummary } from '../../core/models/analytics.model';
import { StatisticsEngine } from '../../core/engine/statistics.engine';
import { DecimalPipe } from '@angular/common';
import { CompareRadarComponent } from '../../shared/organisms/compare-radar/compare-radar.component';
import { BadgeComponent } from '../../shared/atoms/badge/badge.component';
import { ProgressBarComponent } from '../../shared/atoms/progress-bar/progress-bar.component';

interface MetricComparison {
  label: string;
  a: number;
  b: number;
  unit: string;
  higherIsBetter: boolean;
  winner: 'a' | 'b' | 'tie';
}

@Component({
  selector: 'df-compare',
  standalone: true,
  imports: [RouterLink, DecimalPipe, BadgeComponent, ProgressBarComponent, CompareRadarComponent],
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss']
})
export class CompareComponent implements OnInit, OnDestroy {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  readonly analytics = inject(AnalyticsService);

  readonly playerA = signal<PlayerSummary | null>(null);
  readonly playerB = signal<PlayerSummary | null>(null);
  readonly isLoading = signal(true);
  readonly error     = signal<string | null>(null);

  // ✅ Field level = injection context (NG0203 fix)
  private readonly players$ = toObservable(this.analytics.players);
  private sub?: Subscription;

  ngOnInit(): void {
    if (!this.analytics.index()) this.analytics.load();

    const id1 = this.route.snapshot.paramMap.get('id1');
    const id2 = this.route.snapshot.paramMap.get('id2');

    if (!id1 || !id2) {
      this.error.set('Two player IDs are required in the URL.');
      this.isLoading.set(false);
      return;
    }

    this.sub = this.players$.pipe(
      filter(players => players.length > 0),
      take(1)
    ).subscribe(players => {
      const a = players.find(p => p.id === id1);
      const b = players.find(p => p.id === id2);
      if (!a) { this.error.set(`Player "${id1}" not found.`); }
      else if (!b) { this.error.set(`Player "${id2}" not found.`); }
      else {
        this.playerA.set(a);
        this.playerB.set(b);
      }
      this.isLoading.set(false);
    });
  }

  // IBM DS: metric comparison with winner detection
  readonly metrics = computed<MetricComparison[]>(() => {
    const a = this.playerA();
    const b = this.playerB();
    if (!a || !b) return [];

    const compare = (
      label: string, aVal: number, bVal: number,
      unit: string, higherIsBetter = true
    ): MetricComparison => {
      const delta = aVal - bVal;
      const winner: 'a' | 'b' | 'tie' =
        Math.abs(delta) < 0.01 ? 'tie' :
        (higherIsBetter ? (delta > 0 ? 'a' : 'b') : (delta < 0 ? 'a' : 'b'));
      return { label, a: aVal, b: bVal, unit, higherIsBetter, winner };
    };

    return [
      compare('Reputation',        a.reputation,           b.reputation,           '',   true),
      compare('Notebook avg',      a.notebookAvg,          b.notebookAvg,          '%',  true),
      compare('Cases completed',   a.casesCompleted,       b.casesCompleted,       '',   true),
      compare('Lies discovered',   a.liesDiscovered,       b.liesDiscovered,       '',   true),
      compare('Hidden rate',       a.hiddenDecisionRate * 100, b.hiddenDecisionRate * 100, '%', false),
      compare('Rep percentile',    a.percentiles.reputation,   b.percentiles.reputation,   'P', true),
      compare('Notebook percentile',a.percentiles.notebookCompletion, b.percentiles.notebookCompletion, 'P', true),
      compare('Speed percentile',  a.percentiles.sessionEfficiency,  b.percentiles.sessionEfficiency,  'P', true),
    ];
  });

  readonly scoreA = computed(() =>
    this.metrics().filter(m => m.winner === 'a').length
  );
  readonly scoreB = computed(() =>
    this.metrics().filter(m => m.winner === 'b').length
  );
  readonly winner = computed(() => {
    const sa = this.scoreA(); const sb = this.scoreB();
    if (sa === sb) return 'tie';
    return sa > sb ? 'a' : 'b';
  });

  // IBM DS: z-score distance between the two players
  readonly zDistance = computed(() => {
    const a = this.playerA();
    const b = this.playerB();
    const all = this.analytics.players();
    if (!a || !b || !all.length) return null;
    const reps = all.map(p => p.reputation);
    const zA = StatisticsEngine.zScore(a.reputation, StatisticsEngine.mean(reps), StatisticsEngine.stdDev(reps));
    const zB = StatisticsEngine.zScore(b.reputation, StatisticsEngine.mean(reps), StatisticsEngine.stdDev(reps));
    return Math.round(Math.abs(zA - zB) * 100) / 100;
  });

  readonly Math = Math; // expose to template

  getStyleVariant(style: string): 'success' | 'info' | 'danger' | 'warning' {
    const map: Record<string, 'success' | 'info' | 'danger' | 'warning'> = {
      Completionist: 'success', Speedrunner: 'info',
      Manipulator: 'danger',   Balanced: 'warning'
    };
    return map[style] ?? 'warning';
  }

  swapPlayers(): void {
    const a = this.playerA();
    const b = this.playerB();
    if (a && b) {
      this.router.navigate(['/compare', b.id, a.id]);
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}