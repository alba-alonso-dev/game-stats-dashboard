import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompareComponent } from './compare.component';
import { AnalyticsService } from '../../core/services/analytics.service';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const makePlayers = () => [
  { id: 'p1', name: 'Alba',  rank: 'Senior Detective', rankLevel: 3, casesCompleted: 4, totalPlaytimeSeconds: 18000, reputation: 74, notebookAvg: 86, hiddenDecisionRate: 0.40, liesDiscovered: 14, playStyle: 'Completionist', isOutlier: false, abandoned: false, percentiles: { reputation: 72, accuracy: 88, notebookCompletion: 85, sessionEfficiency: 76 }, dataFile: 'game-data.mock.json' },
  { id: 'p2', name: 'Mikel', rank: 'Detective',        rankLevel: 2, casesCompleted: 4, totalPlaytimeSeconds: 16000, reputation: 61, notebookAvg: 74, hiddenDecisionRate: 0.80, liesDiscovered: 9,  playStyle: 'Manipulator',   isOutlier: false, abandoned: false, percentiles: { reputation: 38, accuracy: 55, notebookCompletion: 42, sessionEfficiency: 55 }, dataFile: 'player_002.mock.json' },
  { id: 'p3', name: 'Ane',   rank: 'Field Detective',  rankLevel: 1, casesCompleted: 4, totalPlaytimeSeconds: 12000, reputation: 88, notebookAvg: 72, hiddenDecisionRate: 0.10, liesDiscovered: 16, playStyle: 'Speedrunner',   isOutlier: false, abandoned: false, percentiles: { reputation: 95, accuracy: 92, notebookCompletion: 42, sessionEfficiency: 97 }, dataFile: 'player_003.mock.json' },
] as any[];

describe('CompareComponent', () => {
  let fixture: ComponentFixture<CompareComponent>;
  let component: CompareComponent;
  let mockRouter: jasmine.SpyObj<Router>;
  let paramMap$: BehaviorSubject<Map<string, string>>;

  const setup = async (id1 = 'p1', id2 = 'p2') => {
    paramMap$ = new BehaviorSubject(new Map([['id1', id1], ['id2', id2]]));
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    const paramMapObs = {
      asObservable: () => paramMap$.asObservable(),
      get: (k: string) => paramMap$.value.get(k) ?? null,
    };

    await TestBed.configureTestingModule({
      imports: [CompareComponent, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            snapshot: {
              paramMap: { get: (k: string) => (k === 'id1' ? id1 : id2) }
            }
          }
        },
        {
          provide: AnalyticsService,
          useValue: {
            players:   signal(makePlayers()),
            index:     signal({ meta: {}, players: makePlayers() }),
            aggregate: signal({ correlations: {} }),
            load:      jasmine.createSpy('load'),
          }
        },
        { provide: Router, useValue: mockRouter },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CompareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => { await setup(); });

  // ── Basic ──
  it('should create', () => expect(component).toBeTruthy());

  it('should resolve playerA from route param', () => {
    expect(component.playerA()?.name).toBe('Alba');
  });

  it('should resolve playerB from route param', () => {
    expect(component.playerB()?.name).toBe('Mikel');
  });

  it('should not be loading after resolution', () => {
    expect(component.isLoading()).toBeFalse();
  });

  // ── Metrics ──
  it('should generate 8 metric comparisons', () => {
    expect(component.metrics().length).toBe(8);
  });

  it('reputation winner: Alba (74) > Mikel (61)', () => {
    const rep = component.metrics().find(m => m.label === 'Reputation')!;
    expect(rep.winner).toBe('a');
  });

  it('hidden rate winner: lower is better — Alba (40%) < Mikel (80%)', () => {
    const m = component.metrics().find(m => m.label === 'Hidden rate')!;
    expect(m.winner).toBe('a');
  });

  it('scoreA + scoreB + ties should equal total metrics', () => {
    const ties = component.metrics().filter(m => m.winner === 'tie').length;
    expect(component.scoreA() + component.scoreB() + ties).toBe(8);
  });

  it('winner should be a or b or tie', () => {
    expect(['a', 'b', 'tie']).toContain(component.winner());
  });

  // ── Swap ──
  it('swapPlayers should navigate with reversed IDs', () => {
    component.swapPlayers();
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/compare', 'p2', 'p1'],
      jasmine.objectContaining({ replaceUrl: false })
    );
  });

  it('swapPlayers should not navigate when players are null', () => {
    component.playerA.set(null);
    component.swapPlayers();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  // ── Selector panel ──
  it('selectorOpen should default to null', () => {
    expect(component.selectorOpen()).toBeNull();
  });

  it('openSelector should set selectorOpen slot', () => {
    component.openSelector('a');
    expect(component.selectorOpen()).toBe('a');
  });

  it('openSelector should reset selectorSearch', () => {
    component.selectorSearch.set('test');
    component.openSelector('b');
    expect(component.selectorSearch()).toBe('');
  });

  it('closeSelector should clear selectorOpen', () => {
    component.openSelector('a');
    component.closeSelector();
    expect(component.selectorOpen()).toBeNull();
  });

  it('selectorResults should return all players when search is empty', () => {
    expect(component.selectorResults().length).toBe(3);
  });

  it('selectorResults should filter by name', () => {
    component.selectorSearch.set('alba');
    expect(component.selectorResults().length).toBe(1);
    expect(component.selectorResults()[0].name).toBe('Alba');
  });

  it('selectorResults should filter by play style', () => {
    component.selectorSearch.set('speedrunner');
    expect(component.selectorResults().every((p: any) => p.playStyle === 'Speedrunner')).toBeTrue();
  });

  it('selectPlayer for slot A should navigate with new A id', () => {
    component.openSelector('a');
    component.selectPlayer(makePlayers()[2]); // Ane
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/compare', 'p3', 'p2']);
  });

  it('selectPlayer for slot B should navigate with new B id', () => {
    component.openSelector('b');
    component.selectPlayer(makePlayers()[2]); // Ane
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/compare', 'p1', 'p3']);
  });

  it('selectPlayer should close the panel', () => {
    component.openSelector('a');
    component.selectPlayer(makePlayers()[0]);
    expect(component.selectorOpen()).toBeNull();
  });

  // ── z-distance ──
  it('zDistance should be a non-negative number', () => {
    const z = component.zDistance();
    if (z !== null) {
      expect(z).toBeGreaterThanOrEqual(0);
      expect(typeof z).toBe('number');
    }
  });

  // ── Helpers ──
  it('should return correct badge variants', () => {
    expect(component.getStyleVariant('Completionist')).toBe('success');
    expect(component.getStyleVariant('Manipulator')).toBe('danger');
    expect(component.getStyleVariant('Speedrunner')).toBe('info');
    expect(component.getStyleVariant('Balanced')).toBe('warning');
  });

  it('Math should be exposed', () => {
    expect(component.Math).toBe(Math);
  });

  // ── Error: invalid player ──
  it('should set error when player id not found', async () => {
    await setup('INVALID', 'p2');
    expect(component.error()).toContain('INVALID');
  });

  // ── Render ──
  it('should render player names', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alba');
    expect(text).toContain('Mikel');
  });

  it('should render swap button when both players loaded', () => {
    const btn = fixture.nativeElement.querySelector('.compare-page__swap');
    expect(btn).toBeTruthy();
  });

  it('should render selector panel when selectorOpen is set', () => {
    component.openSelector('a');
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.selector-panel');
    expect(panel).toBeTruthy();
  });

  it('should render overlay when selector is open', () => {
    component.openSelector('b');
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.selector-overlay');
    expect(overlay).toBeTruthy();
  });

  it('should not render selector panel when closed', () => {
    const panel = fixture.nativeElement.querySelector('.selector-panel');
    expect(panel).toBeNull();
  });

  it('should render empty slot button when no player set', () => {
    component.playerA.set(null);
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('.compare-slot__empty');
    expect(empty).toBeTruthy();
  });

  it('should render metric table rows', () => {
    const rows = fixture.nativeElement.querySelectorAll('.metric-row');
    expect(rows.length).toBe(8);
  });
});