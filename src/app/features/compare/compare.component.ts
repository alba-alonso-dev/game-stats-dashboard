import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { filter, take, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../core/services/analytics.service';
import { PlayerSummary } from '../../core/models/analytics.model';
import { StatisticsEngine } from '../../core/engine/statistics.engine';
import { BadgeComponent } from '../../shared/atoms/badge/badge.component';
import { ProgressBarComponent } from '../../shared/atoms/progress-bar/progress-bar.component';
import { CompareRadarComponent } from '../../shared/organisms/compare-radar/compare-radar.component';

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
  imports: [
    RouterLink, FormsModule, DecimalPipe,
    BadgeComponent, ProgressBarComponent, CompareRadarComponent,
  ],
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss']
})
export class CompareComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly analytics = inject(AnalyticsService);

  readonly playerA = signal<PlayerSummary | null>(null);
  readonly playerB = signal<PlayerSummary | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly selectorOpen = signal<'a' | 'b' | null>(null);
  readonly selectorSearch = signal('');

  readonly selectorResults = computed(() => {
    const q = this.selectorSearch().toLowerCase().trim();
    const all = this.analytics.players();
    if (!q) return all;
    return all.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.playStyle.toLowerCase().includes(q)
    );
  });

  private readonly players$ = toObservable(this.analytics.players);
  private sub?: Subscription;

  ngOnInit(): void {
    if (!this.analytics.index()) this.analytics.load();

    this.sub = combineLatest([
      this.route.paramMap,
      this.players$.pipe(filter(p => p.length > 0), take(1)),
    ]).pipe(
      switchMap(([params, players]) => {
        return this.route.paramMap.pipe(
          filter(() => players.length > 0),
          switchMap(pm => {
            const id1 = pm.get('id1');
            const id2 = pm.get('id2');
            return [{ id1, id2, players }];
          })
        );
      })
    ).subscribe(({ id1, id2 }) => {
      this.resolve(id1, id2, this.analytics.players());
    });
  }

  private resolve(
    id1: string | null,
    id2: string | null,
    players: PlayerSummary[]
  ): void {
    this.error.set(null);

    // Mapeamos los jugadores basándonos en la URL
    // Usamos 'none' o null como identificador de slot vacío
    const a = players.find(p => p.id === id1) ?? null;
    const b = players.find(p => p.id === id2) ?? null;

    this.playerA.set(a);
    this.playerB.set(b);

    // Validar errores solo si se intentaron pasar IDs reales que no existen
    if (id1 && id1 !== 'none' && !a) {
      this.error.set(`Detective "${id1}" not found.`);
    } else if (id2 && id2 !== 'none' && !b) {
      this.error.set(`Detective "${id2}" not found.`);
    }

    // Si la URL está vacía en algún punto, abrimos el selector automáticamente
    if (!id1 || id1 === 'none') {
      this.selectorOpen.set('a');
    } else if (!id2 || id2 === 'none') {
      this.selectorOpen.set('b');
    }

    this.isLoading.set(false);
  }

  swapPlayers(): void {
    const a = this.playerA();
    const b = this.playerB();
    if (!a || !b) return;
    this.router.navigate(['/compare', b.id, a.id]);
  }

  openSelector(slot: 'a' | 'b'): void {
    this.selectorSearch.set('');
    this.selectorOpen.set(slot);
  }

  closeSelector(): void {
    this.selectorOpen.set(null);
    this.selectorSearch.set('');
  }

  selectPlayer(player: PlayerSummary): void {
    const slot = this.selectorOpen();
    const currentA = this.playerA();
    const currentB = this.playerB();

    if (slot === 'a') {
      // Si seleccionamos A, mantenemos el ID de B si existe, sino usamos 'none'
      const idB = currentB?.id ?? 'none';
      this.router.navigate(['/compare', player.id, idB]);
    } else if (slot === 'b') {
      // Si seleccionamos B, mantenemos el ID de A si existe, sino usamos 'none'
      const idA = currentA?.id ?? 'none';
      this.router.navigate(['/compare', idA, player.id]);
    }
    this.closeSelector();
  }

  readonly metrics = computed<MetricComparison[]>(() => {
    const a = this.playerA();
    const b = this.playerB();
    if (!a || !b) return [];

    const cmp = (
      label: string, aVal: number, bVal: number,
      unit: string, higherIsBetter = true
    ): MetricComparison => {
      const delta = aVal - bVal;
      const winner: 'a' | 'b' | 'tie' =
        Math.abs(delta) < 0.01 ? 'tie' :
        higherIsBetter ? (delta > 0 ? 'a' : 'b') : (delta < 0 ? 'a' : 'b');
      return { label, a: aVal, b: bVal, unit, higherIsBetter, winner };
    };

    return [
      cmp('Reputation',          a.reputation,                    b.reputation,                    '',  true),
      cmp('Notebook avg',        a.notebookAvg,                   b.notebookAvg,                   '%', true),
      cmp('Cases completed',     a.casesCompleted,                b.casesCompleted,                '',  true),
      cmp('Lies discovered',     a.liesDiscovered,                b.liesDiscovered,                '',  true),
      cmp('Hidden rate',         a.hiddenDecisionRate * 100,      b.hiddenDecisionRate * 100,      '%', false),
      cmp('Rep percentile',      a.percentiles.reputation,         b.percentiles.reputation,         'P', true),
      cmp('Notebook percentile', a.percentiles.notebookCompletion, b.percentiles.notebookCompletion, 'P', true),
      cmp('Speed percentile',    a.percentiles.sessionEfficiency,  b.percentiles.sessionEfficiency,  'P', true),
    ];
  });

  readonly scoreA = computed(() => this.metrics().filter(m => m.winner === 'a').length);
  readonly scoreB = computed(() => this.metrics().filter(m => m.winner === 'b').length);
  readonly winner = computed(() => {
    if (!this.playerA() || !this.playerB()) return null;
    const sa = this.scoreA(), sb = this.scoreB();
    return sa === sb ? 'tie' : sa > sb ? 'a' : 'b';
  });

  readonly zDistance = computed(() => {
    const a = this.playerA(), b = this.playerB();
    const all = this.analytics.players();
    if (!a || !b || !all.length) return null;
    const reps = all.map(p => p.reputation);
    const m = StatisticsEngine.mean(reps);
    const s = StatisticsEngine.stdDev(reps);
    const zA = StatisticsEngine.zScore(a.reputation, m, s);
    const zB = StatisticsEngine.zScore(b.reputation, m, s);
    return Math.round(Math.abs(zA - zB) * 100) / 100;
  });

  readonly Math = Math;

  getStyleVariant(style: string): 'success' | 'info' | 'danger' | 'warning' {
    const map: Record<string, 'success' | 'info' | 'danger' | 'warning'> = {
      Completionist: 'success', Speedrunner: 'info',
      Manipulator: 'danger', Balanced: 'warning'
    };
    return map[style] ?? 'warning';
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}