import "./fonts.css";
import { Composition } from "remotion";
import { Debut, DEBUT_DURATION } from "./Debut";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="RochambeauDebutVertical" component={Debut} durationInFrames={DEBUT_DURATION} fps={30} width={1080} height={1920} />
    <Composition id="RochambeauDebut" component={Debut} durationInFrames={DEBUT_DURATION} fps={30} width={1920} height={1080} />
  </>
);
