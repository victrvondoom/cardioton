import { HeartViewer } from "../scene/cardio__src_scene__HeartViewer";

/** 3D heart for the landing showcase (lazy-loaded; probabilities are driven by the parent). */
export default function HeroHeart({ values }: { values: Record<string, number> }) {
  return <HeartViewer probabilities={values} selectedId={null} onSelect={() => {}} transparent zoom={false} />;
}
