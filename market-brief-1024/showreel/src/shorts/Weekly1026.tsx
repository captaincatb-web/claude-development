import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT, useT} from '../news/kit';
import {semiTheme} from '../news/Semis';
import chips from './data/wk1_chips.json';
import bigtech from './data/wk2_bigtech.json';
import fomc from './data/wk3_fomc.json';
import {Big, Label, LineChart, Pop, SceneProps, Short, Source, Stage, Tile, VoiceData} from './kit';

const at = (L: number[], E: number[], i: number, frac: number) => Math.round(L[i] + (E[i] - L[i]) * frac);

// ---------- shared pieces ----------
const Badge: React.FC<{delay: number; children: React.ReactNode; color?: string}> = ({delay, children, color}) => {
  const t = useT();
  const f = useCurrentFrame();
  return (
    <Pop delay={delay}>
      <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, padding: '16px 26px', borderRadius: 16, background: color ?? t.warn, color: '#fff', fontFamily: FONT, fontSize: 36, fontWeight: 900, opacity: 0.85 + 0.15 * Math.sin(f / 5)}}>{children}</div>
    </Pop>
  );
};

const Row: React.FC<{d: number; k: string; v: string; hot: string; mark?: string}> = ({d, k, v, hot, mark = '✓'}) => {
  const t = useT();
  return (
    <Pop delay={d}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26, padding: '22px 30px', borderRadius: 26, background: t.panel, border: `2px solid ${hot}`, fontFamily: FONT}}>
        <div style={{minWidth: 66, height: 66, borderRadius: 33, background: hot, color: t.bg, fontSize: mark.length > 1 ? 28 : 40, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px'}}>{mark}</div>
        <div><div style={{fontSize: 42, fontWeight: 900, color: t.ink}}>{k}</div><div style={{fontSize: 28, fontWeight: 600, color: '#A9B3C4', marginTop: 4}}>{v}</div></div>
      </div>
    </Pop>
  );
};

const Note: React.FC<{delay: number; children: React.ReactNode}> = ({delay, children}) => (
  <Pop delay={delay}><div style={{fontFamily: FONT, fontSize: 28, fontWeight: 600, color: '#A9B3C4', marginTop: 22}}>{children}</div></Pop>
);

const Unit: React.FC<{delay: number; children: React.ReactNode}> = ({delay, children}) => {
  const t = useT();
  return <Pop delay={delay}><span style={{fontFamily: FONT, fontWeight: 900, fontSize: 80, color: t.ink}}>{children}</span></Pop>;
};

// =====================================================================
// 1) Samsung / SK hynix earnings week
// =====================================================================
const C0: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>삼성전자 · 3분기 잠정 영업이익 (10.8 발표)</Label>
      <div style={{height: 12}} />
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <Big to={107.4} decimals={1} start={at(L, E, 1, 0.15)} dur={34} size={230} color={t.accent} />
        <Unit delay={at(L, E, 1, 0.35)}>조 원</Unit>
      </div>
      <div style={{height: 30}} />
      <div style={{display: 'flex', gap: 18}}>
        <Tile k="전년 동기 대비" v="+782.5%" delay={at(L, E, 1, 0.6)} hot={t.accent} vs={58} />
        <Tile k="매출" v="195조 원" delay={at(L, E, 1, 0.75)} vs={58} />
      </div>
      <Source>삼성전자 잠정실적(YTN·파이낸셜뉴스) 2026.10.8</Source>
    </Stage>
  );
};
const C1: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>SK하이닉스 · 3분기 컨센서스</Label>
      <div style={{height: 12}} />
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <Big to={77.2} decimals={1} start={at(L, E, 1, 0.35)} dur={30} size={230} color={t.accent2} />
        <Unit delay={at(L, E, 1, 0.5)}>조 원</Unit>
      </div>
      <Pop delay={at(L, E, 1, 0.45)}><div style={{fontFamily: FONT, fontSize: 34, fontWeight: 700, color: t.dim, margin: '6px 0 26px'}}>영업이익 예상치</div></Pop>
      <div style={{display: 'flex', gap: 18}}>
        <Tile k="예상 매출" v="98.5조 원" delay={at(L, E, 1, 0.6)} vs={54} />
        <Tile k="예상 이익률" v="78.3%" delay={at(L, E, 1, 0.8)} hot={t.accent2} vs={54} />
      </div>
      <Source>와이즈리포트 컨센서스(파이낸셜뉴스 10.25) · 발표 10.28(수)</Source>
    </Stage>
  );
};
const C2: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4} color={t.warn}>코스피 · 6월 고점 대비</Label>
      <div style={{height: 10}} />
      <Big to={-40.9} decimals={1} suffix="%" start={at(L, E, 1, 0.1)} dur={30} color={t.warn} size={210} shake />
      <div style={{height: 10}} />
      <LineChart delay={L[1] + 6} h={170} pts={[{x: '6월 고점', y: 9385.59}, {x: '10.16', y: 5668.05}, {x: '10.23', y: 5550.3}]} fmt={(n) => n.toLocaleString('en-US', {maximumFractionDigits: 0})} />
      <Note delay={at(L, E, 1, 0.65)}>지난주 -2.08% · 외국인 7,231억 원 순매도</Note>
      <Source>Investing.com 52주 고점·뉴시스 주간증시전망</Source>
    </Stage>
  );
};
const C3: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>실적은 좋은데 주가가 약한 이유</Label>
      <div style={{height: 22}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <Row d={at(L, E, 1, 0.05)} k="AI 투자 수익성 우려" v="빅테크 설비투자 회수 의문" hot={t.warn} mark="1" />
        <Row d={at(L, E, 1, 0.45)} k="자사주 매입 종료" v="주가를 받치던 수요가 사라짐" hot={t.warn} mark="2" />
        <Row d={L[2] + 4} k="SK하이닉스 40조 원" v="10.21 매입 완료 · 2,407만 주 전량 소각 예정" hot={t.accent2} mark="₩" />
      </div>
      <Source>조선비즈·파이낸셜뉴스 2026.10.25</Source>
    </Stage>
  );
};
const C4: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>이번 주 관건 · 추가 주주환원</Label>
      <div style={{height: 12}} />
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <Big to={30} start={at(L, E, 1, 0.45)} dur={26} size={230} color={t.accent} />
        <Unit delay={at(L, E, 1, 0.55)}>조 원</Unit>
      </div>
      <Pop delay={at(L, E, 1, 0.55)}><div style={{fontFamily: FONT, fontSize: 34, fontWeight: 700, color: t.dim, margin: '6px 0 26px'}}>삼성전자 예고 현금배당 규모</div></Pop>
      <Tile k="삼성전자 올해 환원 계획" v="90조~110조 원" sub="나머지는 내년 1월 이후 배당·자사주" delay={at(L, E, 1, 0.8)} vs={52} />
      <Source>파이낸셜뉴스(뉴스1) 2026.10.25</Source>
    </Stage>
  );
};
const C5: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>발표 일정 (한국 시간)</Label>
      <div style={{height: 22}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <Row d={at(L, E, 1, 0.05)} k="SK하이닉스" v="3분기 실적 · 9시 전 발표, 9시 콘퍼런스콜" hot={t.accent2} mark="28 수" />
        <Row d={at(L, E, 1, 0.5)} k="삼성전자" v="3분기 확정실적 · 사업부별 숫자 첫 공개" hot={t.accent} mark="29 목" />
      </div>
      <Note delay={at(L, E, 1, 0.85)}>※ 투자 권유가 아닌 뉴스 요약입니다.</Note>
      <Source>SK하이닉스 IR 공지 · 디지털데일리 2026.10.25</Source>
    </Stage>
  );
};
export const ShortWk1Chips: React.FC = () => <Short theme={semiTheme} label="반도체 실적" date="2026.10.26 (월)" data={chips as unknown as VoiceData} scenes={[C0, C1, C2, C3, C4, C5]} />;

// =====================================================================
// 2) Big tech earnings
// =====================================================================
const B0: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4} color={t.warn}>지난주 목요일(10.22) 나스닥</Label>
      <div style={{height: 10}} />
      <Big to={-2.6} decimals={1} suffix="%" start={at(L, E, 1, 0.2)} dur={26} color={t.warn} size={230} shake />
      <div style={{height: 20}} />
      <Badge delay={at(L, E, 1, 0.55)}>6월 이후 최악의 하루</Badge>
      <Note delay={at(L, E, 1, 0.75)}>방아쇠 · 메타의 AI 투자(설비투자) 계획</Note>
      <Source>CNBC 2026.10.25 · 로이터</Source>
    </Stage>
  );
};
const B1: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>이번 주 빅테크 실적 (미국 장 마감 후)</Label>
      <div style={{height: 22}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <Row d={at(L, E, 1, 0.05)} k="마이크로소프트" v="미국 10.28(수) → 한국 29일(목) 새벽" hot={t.accent2} mark="수" />
        <Row d={at(L, E, 1, 0.2)} k="알파벳" v="미국 10.28(수) → 한국 29일(목) 새벽" hot={t.accent2} mark="수" />
        <Row d={at(L, E, 1, 0.38)} k="아마존" v="미국 10.29(목) → 한국 30일(금) 새벽" hot={t.accent} mark="목" />
      </div>
      <Source>CNBC 실적 일정 2026.10.25</Source>
    </Stage>
  );
};
const B2: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>시장 기대치 · 매출 증가율 (전년 대비)</Label>
      <div style={{height: 26}} />
      <div style={{display: 'flex', gap: 18}}>
        <Tile k="알파벳" v="약 +25%" delay={at(L, E, 1, 0.15)} hot={t.accent} vs={64} />
        <Tile k="마이크로소프트" v="+16.8%" sub="EPS +14.3%" delay={at(L, E, 1, 0.55)} hot={t.accent2} vs={64} />
      </div>
      <div style={{height: 22}} />
      <Tile k="아마존 3분기 매출 가이던스" v="$1,970억~2,020억" sub="전년 대비 +9~12%" delay={L[2] + 4} vs={56} />
      <Source>LSEG(CNBC 10.25) · 아마존 가이던스(TradingKey)</Source>
    </Stage>
  );
};
const B3: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>숫자보다 중요한 것</Label>
      <div style={{height: 22}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <Row d={at(L, E, 1, 0.05)} k="설비투자(CAPEX)" v="데이터센터 투자 계획 · 내년 가이던스" hot={t.warn} mark="1" />
        <Row d={at(L, E, 1, 0.5)} k="투자 회수" v="클라우드·AI 매출, 현금흐름으로 돌아오나" hot={t.accent} mark="2" />
      </div>
      <Source>로이터·CNBC 2026.10.25</Source>
    </Stage>
  );
};
const B4: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  const step = (i: number) => at(L, E, 1, 0.15 + i * 0.25);
  const Box = ({d, k}: {d: number; k: string}) => (
    <Pop delay={d}><div style={{padding: '30px 22px', borderRadius: 24, background: t.panel, border: `2px solid ${t.accent2}`, fontFamily: FONT, fontSize: 42, fontWeight: 900, color: t.ink, textAlign: 'center', width: 250}}>{k}</div></Pop>
  );
  const Arr = ({d}: {d: number}) => <Pop delay={d}><div style={{fontFamily: FONT, fontSize: 60, fontWeight: 900, color: t.dim}}>→</div></Pop>;
  return (
    <Stage>
      <Label delay={4}>빅테크 투자와 한국 반도체</Label>
      <div style={{height: 40}} />
      <div style={{display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center'}}>
        <Box d={step(0)} k="빅테크 투자" /><Arr d={step(1) - 4} /><Box d={step(1)} k="AI 서버" /><Arr d={step(2) - 4} /><Box d={step(2)} k="HBM 수요" />
      </div>
      <Note delay={at(L, E, 1, 0.85)}>SK하이닉스(28일)·삼성전자(29일) 실적과 같은 주</Note>
    </Stage>
  );
};
const B5: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>체크 시간 (한국 시간)</Label>
      <div style={{height: 22}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <Row d={L[1] + 2} k="29일(목) 새벽" v="마이크로소프트 · 알파벳" hot={t.accent2} />
        <Row d={at(L, E, 1, 0.5)} k="30일(금) 새벽" v="아마존" hot={t.accent} />
      </div>
      <Note delay={at(L, E, 1, 0.8)}>※ 투자 권유가 아닌 뉴스 요약입니다.</Note>
    </Stage>
  );
};
export const ShortWk2Bigtech: React.FC = () => <Short theme={semiTheme} label="빅테크 실적" date="2026.10.26 (월)" data={bigtech as unknown as VoiceData} scenes={[B0, B1, B2, B3, B4, B5]} />;

// =====================================================================
// 3) FOMC + oil + GDP
// =====================================================================
const F0: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4} color={t.accent2}>10월 FOMC · 금리 동결 확률</Label>
      <div style={{height: 10}} />
      <Big to={87} suffix="%" start={at(L, E, 1, 0.15)} dur={30} color={t.accent2} size={260} />
      <Note delay={at(L, E, 1, 0.6)}>CME 페드워치 기준 · 회의 10.27~28(현지)</Note>
      <Source>onblanc(CME FedWatch) 2026.10.25 · 연준 일정</Source>
    </Stage>
  );
};
const F1: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>진짜 관전 포인트</Label>
      <div style={{height: 22}} />
      <Pop delay={at(L, E, 1, 0.1)}>
        <div style={{padding: '40px 36px', borderRadius: 30, background: t.panel, border: `3px solid ${t.warn}`, fontFamily: FONT}}>
          <div style={{fontSize: 34, fontWeight: 700, color: t.dim}}>의장 기자회견</div>
          <div style={{fontSize: 66, fontWeight: 900, color: t.ink, marginTop: 10, letterSpacing: -2}}>"추가 인상" 언급은?</div>
        </div>
      </Pop>
      <Note delay={at(L, E, 1, 0.7)}>이번 회의는 점도표(경제전망) 발표 없음</Note>
      <Source>TradingKey 2026.10.25 · 조선비즈</Source>
    </Stage>
  );
};
const F2: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4} color={t.warn}>인상 우려가 나오는 이유</Label>
      <div style={{height: 22}} />
      <Row d={at(L, E, 1, 0.1)} k="9월 물가" v="시장 예상보다 높게 나옴" hot={t.warn} mark="1" />
      <div style={{height: 18}} />
      <div style={{display: 'flex', gap: 18}}>
        <Tile k="브렌트유 (10.23)" v="$116.72" sub="4월 29일 이후 최고" delay={L[2] + 4} hot={t.warn} vs={56} />
        <Tile k="미국 10년물" v="5.00%" sub="10.23 · +4.8bp" delay={at(L, E, 2, 0.6)} hot={t.accent2} vs={56} />
      </div>
      <Source>조선비즈·onblanc 10.25 · 로이터·MT Newswires 10.23</Source>
    </Stage>
  );
};
const F3: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>3분기 GDP 발표</Label>
      <div style={{height: 22}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <Row d={at(L, E, 1, 0.05)} k="한국" v="27일(화) · 한국은행 속보치" hot={t.accent} mark="화" />
        <Row d={at(L, E, 1, 0.45)} k="미국" v="29일(목) 현지 8:30 · 첫 추정치" hot={t.accent2} mark="목" />
      </div>
      <Source>뉴시스 주간증시전망 · 미국 경제분석국 일정</Source>
    </Stage>
  );
};
const F4: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>FOMC 결과 · 한국 시간</Label>
      <div style={{height: 10}} />
      <div style={{display: 'flex', alignItems: 'baseline', gap: 18}}>
        <Pop delay={at(L, E, 1, 0.05)}><span style={{fontFamily: FONT, fontWeight: 900, fontSize: 210, color: t.accent2, letterSpacing: -8}}>03:00</span></Pop>
      </div>
      <Pop delay={at(L, E, 1, 0.15)}><div style={{fontFamily: FONT, fontSize: 40, fontWeight: 800, color: t.ink, margin: '4px 0 26px'}}>10월 29일(목) 새벽 <span style={{color: t.dim, fontWeight: 600, fontSize: 30}}>· 현지 28일 오후 2시</span></div></Pop>
      <Tile k="같은 날 새벽" v="마이크로소프트 · 알파벳 실적" delay={at(L, E, 1, 0.6)} vs={48} />
      <Source>연준·StockTitan 일정 (미 동부 서머타임 기준)</Source>
    </Stage>
  );
};
const F5: React.FC<SceneProps> = ({L, E}) => {
  const t = useT();
  return (
    <Stage>
      <Label delay={4}>이번 주 세 가지</Label>
      <div style={{height: 22}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <Row d={at(L, E, 1, 0.2)} k="금리" v="FOMC 동결 여부 · 추가 인상 언급" hot={t.accent2} mark="1" />
        <Row d={at(L, E, 1, 0.4)} k="유가" v="브렌트 116달러대 · 중동 긴장" hot={t.warn} mark="2" />
        <Row d={at(L, E, 1, 0.6)} k="실적" v="빅테크 · SK하이닉스 · 삼성전자" hot={t.accent} mark="3" />
      </div>
      <Note delay={at(L, E, 1, 0.85)}>※ 투자 권유가 아닌 뉴스 요약입니다.</Note>
    </Stage>
  );
};
export const ShortWk3Fomc: React.FC = () => <Short theme={semiTheme} label="금리·유가" date="2026.10.26 (월)" data={fomc as unknown as VoiceData} scenes={[F0, F1, F2, F3, F4, F5]} />;
