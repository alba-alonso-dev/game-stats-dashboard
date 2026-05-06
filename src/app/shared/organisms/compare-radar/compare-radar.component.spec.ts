import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompareRadarComponent } from './compare-radar.component';
import { PlayerSummary } from '../../../core/models/analytics.model';

const makePlayer = (name: string, overrides = {}): PlayerSummary => ({
  id: `p_${name}`, name, rank: 'Detective', rankLevel: 2,
  casesCompleted: 4, totalPlaytimeSeconds: 18000,
  reputation: 74, notebookAvg: 86,
  hiddenDecisionRate: 0.4, liesDiscovered: 14,
  playStyle: 'Completionist', isOutlier: false, abandoned: false,
  percentiles: { reputation: 72, accuracy: 88, notebookCompletion: 85, sessionEfficiency: 76 },
  dataFile: 'game-data.mock.json',
  ...overrides,
} as PlayerSummary);

const playerA = makePlayer('Alba');
const playerB = makePlayer('Mikel', {
  reputation: 61, notebookAvg: 74, hiddenDecisionRate: 0.8,
  percentiles: { reputation: 38, accuracy: 55, notebookCompletion: 42, sessionEfficiency: 55 },
});

describe('CompareRadarComponent', () => {
  let fixture: ComponentFixture<CompareRadarComponent>;
  let component: CompareRadarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareRadarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CompareRadarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('playerA', playerA);
    fixture.componentRef.setInput('playerB', playerB);
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should render canvas', () => {
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('should display both player names', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alba');
    expect(text).toContain('Mikel');
  });

  it('toRadarData should return 5 values', () => {
    // Access private method via cast
    const data = (component as any).toRadarData(playerA);
    expect(data.length).toBe(5);
  });

  it('toRadarData values should be in 0-100 range', () => {
    const data = (component as any).toRadarData(playerA);
    data.forEach((v: number) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('discretion axis should be inverse of hiddenDecisionRate', () => {
    // playerA hiddenRate=0.4 → discretion = (1-0.4)*100 = 60
    const dataA = (component as any).toRadarData(playerA);
    expect(dataA[4]).toBe(60);
    // playerB hiddenRate=0.8 → discretion = (1-0.8)*100 = 20
    const dataB = (component as any).toRadarData(playerB);
    expect(dataB[4]).toBe(20);
  });

  it('reputation axis should come from percentiles.reputation', () => {
    const dataA = (component as any).toRadarData(playerA);
    expect(dataA[0]).toBe(playerA.percentiles.reputation); // 72
  });

  it('notebook axis should come from percentiles.notebookCompletion', () => {
    const dataA = (component as any).toRadarData(playerA);
    expect(dataA[1]).toBe(playerA.percentiles.notebookCompletion); // 85
  });

  it('should show radar overlay panel', () => {
    const panel = fixture.nativeElement.querySelector('.cr-panel');
    expect(panel).toBeTruthy();
  });

  it('should show axis note about discretion', () => {
    expect(fixture.nativeElement.textContent).toContain('Discretion');
  });
});