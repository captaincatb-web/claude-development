import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT, useT} from '../news/kit';
import {semiTheme} from '../news/Semis';
import data from './data/brief1024.json';
import {Big, Label, LineChart, Pop, SceneProps, Short, SignedBars, Source, Stage, Tile, VoiceData} from './kit';

const at = (L: number[], E: number[], i: number, frac: number) => Math.round(L[i] + (E[i] - L[i]) * frac);

// 0: hook — did the Nasdaq rebound?
const S0: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  const f = useCurrentFrame();
  const q = f < L[1];
  return (
    <Stage>
      <Label delay={4}>나스닥 종합 · 10.23(금) 종가</Label>
      <div style={{height: 14}} />
      {q ? (
        <Pop delay={L[0] + 4}><div style={{fontFamily: FONT, fontWeight: 900, fontSize: 200, color: t.ink, letterSpacing: -8, lineHeight: 1}}>반등<span style={{color: t.accent}}>?</span></div></Pop>
      ) : (
        <Big to={-0.21} decimals={2} suffix="%" start={L[1]} dur={26} color={t.warn} size={220} />
      )}
      <Pop delay={at(L, E, 1, 0.55)}><div style={{fontFamily: FONT, fontSize: 44, fontWeight: 800, color: t.ink, margin: '6px 0 14px'}}>25,955.34 <span style={{color: t.dim, fontWeight: 600, fontSize: 32}}>마감 · 장중엔 상승</span></div></Pop>
      <LineChart delay={L[1] + 10} h={170} pts={[{x: '10.22 종가', y: 26008.86}, {x: '장중 고점', y: 26111.62}, {x: '10.23 종가', y: 25955.34}]} fmt={(n) => n.toLocaleString('en-US', {maximumFractionDigits: 0})} />
      <Source>로이터·CNBC 2026.10.23</Source>
    </Stage>
  );
};

// 1: other indices
const S1: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>미국 증시 · 10.23(금) 등락률</Label>
      <div style={{height: 34}} />
      <SignedBars delay={L[1]} step={at(L, E, 1, 0.2) - L[1]} max={1.4} rows={[
        {label: '나스닥', value: -0.21},
        {label: 'S&P 500', value: -0.52, hi: true},
        {label: '다우', value: -1.23, hi: true},
        {label: '반도체(SOX)', value: 0.4, hi: true},
      ]} />
      <Pop delay={at(L, E, 1, 0.8)} style={{marginTop: 40}}>
        <div style={{fontFamily: FONT, fontSize: 32, fontWeight: 700, color: '#A9B3C4'}}>주간 · 나스닥 -0.7% · S&P 500 -0.5% · 다우 +0.4%</div>
      </Pop>
      <Source>로이터 2026.10.23 · SOX는 로이터 보도치</Source>
    </Stage>
  );
};

// 2: oil
const S2: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  const f = useCurrentFrame();
  return (
    <Stage>
      <Label delay={4} color={t.warn}>브렌트유 · 10.23 정산가</Label>
      <div style={{height: 10}} />
      <Big to={116.72} decimals={2} prefix="$" start={at(L, E, 1, 0.12)} dur={34} color={t.warn} size={200} />
      <Pop delay={at(L, E, 1, 0.45)} style={{margin: '18px 0 30px'}}>
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, padding: '16px 26px', borderRadius: 16, background: t.warn, color: '#fff', fontFamily: FONT, fontSize: 36, fontWeight: 900, opacity: 0.85 + 0.15 * Math.sin(f / 5)}}>
          4월 29일 이후 최고
        </div>
      </Pop>
      <div style={{display: 'flex', gap: 18}}>
        <Tile k="하루" v="+3.14%" delay={at(L, E, 1, 0.55)} hot={t.warn} vs={56} />
        <Tile k="한 주" v="+6.2%" delay={at(L, E, 1, 0.75)} hot={t.warn} vs={56} />
        <Tile k="WTI" v="$103.27" sub="+3.8%" delay={at(L, E, 1, 0.85)} vs={50} />
      </div>
      <Source>로이터·WSJ 2026.10.23 · 후티 반군의 사우디 공격</Source>
    </Stage>
  );
};

// 3: 10-year yield
const S3: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4} color={t.accent2}>미국 10년물 국채금리 · 10.23</Label>
      <div style={{height: 10}} />
      <Big to={5} from={4.95} decimals={2} suffix="%" start={at(L, E, 1, 0.3)} dur={30} color={t.accent2} size={230} />
      <div style={{height: 36}} />
      <div style={{display: 'flex', gap: 18}}>
        <Tile k="하루 변동" v="+4.8bp" delay={at(L, E, 1, 0.55)} hot={t.accent2} vs={60} />
        <Tile k="미시간대 소비자심리" v="5개월 최저" sub="기대 인플레는 5월 이후 최고" delay={at(L, E, 1, 0.8)} vs={52} />
      </div>
      <Source>MT Newswires(야후 파이낸스) 2026.10.23</Source>
    </Stage>
  );
};

// 4: KOSPI dramatic reversal
const S4: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>코스피 · 10.23(금) 종가</Label>
      <div style={{height: 6}} />
      <Big to={0.3} decimals={2} sign suffix="%" start={at(L, E, 1, 0.5)} dur={24} color={t.accent} size={150} />
      <div style={{height: 34}} />
      <LineChart delay={L[1] + 6} color={t.accent} h={130} pts={[{x: '10.22 종가', y: 5533.77}, {x: '장중 저점', y: 5305.98}, {x: '10.23 종가', y: 5550.3}]} fmt={(n) => n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} />
      <div style={{display: 'flex', gap: 18, marginTop: 4, marginBottom: 40}}>
        <Tile k="SK하이닉스" v="+4%대" sub="솔리다임 상장 검토 중단" delay={L[2] + 4} hot={t.accent} vs={48} />
        <Tile k="삼성전자" v="보합" sub="214,500원" delay={at(L, E, 2, 0.5)} vs={48} />
      </div>
      <Source>한국거래소 집계(비즈니스코리아·마켓타임스) 2026.10.23</Source>
    </Stage>
  );
};

// 5: next week checklist
const S5: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  const Row = ({d, k, v, hot}: {d: number; k: string; v: string; hot: string}) => (
    <Pop delay={d}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26, padding: '24px 30px', borderRadius: 26, background: t.panel, border: `2px solid ${hot}`, fontFamily: FONT}}>
        <div style={{width: 66, height: 66, borderRadius: 33, background: hot, color: t.bg, fontSize: 40, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>✓</div>
        <div><div style={{fontSize: 44, fontWeight: 900, color: t.ink}}>{k}</div><div style={{fontSize: 28, fontWeight: 600, color: '#A9B3C4', marginTop: 4}}>{v}</div></div>
      </div>
    </Pop>
  );
  return (
    <Stage>
      <Label delay={4}>다음 주 체크</Label>
      <div style={{height: 22}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <Row d={L[1] + 2} k="빅테크 실적" v="알파벳·마이크로소프트·아마존 · AI 투자 계획" hot={t.accent} />
        <Row d={at(L, E, 1, 0.4)} k="연준 회의" v="금리 결정과 발언" hot={t.accent2} />
        <Row d={at(L, E, 1, 0.75)} k="국제유가" v="브렌트 116달러대 · 중동 긴장" hot={t.warn} />
      </div>
      <Pop delay={at(L, E, 1, 0.9)}><div style={{fontFamily: FONT, fontSize: 28, fontWeight: 600, color: '#A9B3C4', marginTop: 22}}>※ 투자 권유가 아닌 뉴스 요약입니다.</div></Pop>
    </Stage>
  );
};

export const ShortBrief1024: React.FC = () => <Short theme={semiTheme} label="시장" date="2026.10.24 (토)" data={data as unknown as VoiceData} scenes={[S0, S1, S2, S3, S4, S5]} />;
