import { Composition, registerRoot } from "remotion"
import { Training } from "./Training"
import timelines from "./timelines"

// One composition per language that prep.py has built: Training-vi, Training-en, ...
const Root = () => (
    <>
        {timelines.map(t => (
            <Composition key={t.lang} id={`Training-${t.lang}`} component={Training} defaultProps={{ timeline: t }}
                         durationInFrames={t.total} fps={t.fps} width={1920} height={1080} />
        ))}
    </>
)

registerRoot(Root)
