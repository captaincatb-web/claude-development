import {Composition} from 'remotion';
import {Reel} from './Reel';
import {Semis, semiScenes} from './news/Semis';
import {Ai, aiScenes} from './news/Ai';
import {totalFrames} from './news/kit';
import {ShortSemis} from './shorts/Semis';
import {ShortAi} from './shorts/Ai';
import {ShortRoadster} from './shorts/Roadster';
import roadsterData from './shorts/data/roadster.json';
import {ShortSemisEn} from './shorts/SemisEn';
import {ShortAiEn} from './shorts/AiEn';
import semisEnData from './shorts/data/semis_en.json';
import aiEnData from './shorts/data/ai_en.json';
import semisData from './shorts/data/semis.json';
import aiData from './shorts/data/ai.json';
import {ShortBrief1024} from './shorts/Brief1024';
import brief1024Data from './shorts/data/brief1024.json';
export const Root = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={450} fps={30} width={1920} height={1080} />
    <Composition id="NewsSemis" component={Semis} durationInFrames={totalFrames(semiScenes)} fps={30} width={1920} height={1080} />
    <Composition id="NewsAi" component={Ai} durationInFrames={totalFrames(aiScenes)} fps={30} width={1920} height={1080} />
    <Composition id="ShortSemis" component={ShortSemis} durationInFrames={semisData.total} fps={30} width={1080} height={1920} />
    <Composition id="ShortAi" component={ShortAi} durationInFrames={aiData.total} fps={30} width={1080} height={1920} />
    <Composition id="ShortSemisEn" component={ShortSemisEn} durationInFrames={semisEnData.total} fps={30} width={1080} height={1920} />
    <Composition id="ShortAiEn" component={ShortAiEn} durationInFrames={aiEnData.total} fps={30} width={1080} height={1920} />
    <Composition id="ShortRoadster" component={ShortRoadster} durationInFrames={roadsterData.total} fps={30} width={1080} height={1920} />
    <Composition id="ShortBrief1024" component={ShortBrief1024} durationInFrames={brief1024Data.total} fps={30} width={1080} height={1920} />
  </>
);
