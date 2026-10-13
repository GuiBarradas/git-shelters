import { notFound } from 'next/navigation';
import { SceneLab } from '@/components/scene/SceneLab';
export default function Page() {
 if(process.env.NODE_ENV!=='development' && process.env.SCENE_REVIEW_BUILD!=='1') notFound();
 return <SceneLab/>;
}
