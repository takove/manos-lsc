import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Hand,
  Info,
  Leaf,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Video,
  X,
  MessageCircle,
  ChartNoAxesColumnIncreasing,
  LoaderCircle,
  CameraOff,
} from "lucide-react";
import { Avatar, LandmarkOverlay, sharedAvatarViewport } from "./Avatar";
import { lessons, type Frame, type Reference } from "./types";
import { evaluate, type Evaluation } from "./scoring";
import { loadVision, detect, cameraError } from "./vision";
type Mode = "learn" | "practice" | "conversation";
type Progress = Record<
  string,
  { attempts: number; best: number; last: string }
>;
const readProgress = (): Progress => {
  try {
    const raw = JSON.parse(localStorage.getItem("manos-progress-v1") || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const result: Progress = {};
    for (const { id } of lessons) {
      const item = raw[id];
      if (
        item &&
        Number.isInteger(item.attempts) &&
        item.attempts > 0 &&
        Number.isFinite(item.best) &&
        item.best >= 0 &&
        item.best <= 100 &&
        typeof item.last === "string"
      )
        result[id] = item;
    }
    return result;
  } catch {
    return {};
  }
};
export default function App() {
  const [index, setIndex] = useState(0),
    [mode, setMode] = useState<Mode>("learn");
  const [videoError, setVideoError] = useState(false),
    [zoom, setZoom] = useState(false),
    [mirror, setMirror] = useState(true);
  const [reference, setReference] = useState<Reference>(),
    [loadError, setLoadError] = useState("");
  const [playing, setPlaying] = useState(
      () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [speed, setSpeed] = useState(1),
    [frameIndex, setFrameIndex] = useState(0);
  const [teacher, setTeacher] = useState<"avatar" | "video" | "mirror">(
      "avatar",
    ),
    [showExample, setShowExample] = useState(true);
  const [camera, setCamera] = useState<"off" | "loading" | "on" | "error">(
      "off",
    ),
    [error, setError] = useState("");
  const [live, setLive] = useState<Frame>(),
    [phase, setPhase] = useState<"idle" | "countdown" | "recording">("idle"),
    [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<Evaluation>(),
    [attempt, setAttempt] = useState<Frame[]>([]),
    [compare, setCompare] = useState(false);
  const [progress, setProgress] = useState<Progress>(readProgress),
    [modal, setModal] = useState<"about" | "progress" | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null),
    teacherRef = useRef<HTMLVideoElement>(null),
    modalRef = useRef<HTMLElement>(null),
    focusBeforeModal = useRef<HTMLElement | null>(null);
  const openModal = (value: "about" | "progress") => {
    focusBeforeModal.current = document.activeElement as HTMLElement | null;
    setModal(value);
  };
  useEffect(() => {
    if (!modal) return;
    const previous = focusBeforeModal.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
      if (event.key === "Tab") {
        const nodes = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href]",
          ) ?? [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [modal]);
  const stream = useRef<MediaStream | undefined>(undefined),
    raf = useRef(0),
    generation = useRef(0),
    capture = useRef<{
      start: number;
      end: number;
      frames: Frame[];
      reference: Reference;
    } | null>(null);
  useEffect(() => {
    if (camera !== "on" && teacher === "mirror") setTeacher("avatar");
  }, [camera, teacher]);
  const lesson = lessons[index];
  const done = lessons.filter((l) => progress[l.id]?.attempts > 0).length;
  useEffect(() => {
    let cancelled = false;
    setReference(undefined);
    setLoadError("");
    setVideoError(false);
    setResult(undefined);
    setAttempt([]);
    setCompare(false);
    setFrameIndex(0);
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    capture.current = null;
    setPhase("idle");
    setShowExample(mode !== "practice");
    fetch(`/references/${lesson.id}.json`)
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((r: Reference) => {
        if (!cancelled) setReference(r);
      })
      .catch(() => {
        if (!cancelled)
          setLoadError(
            "No se pudo cargar esta lección. Comprueba la conexión y vuelve a intentarlo.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.id, mode]);
  useEffect(() => {
    if (!reference || !playing || !showExample || teacher !== "avatar") return;
    let id = 0,
      last = performance.now(),
      carry = 0;
    const tick = (now: number) => {
      carry += (now - last) * speed;
      last = now;
      const frames = Math.floor(carry / (1000 / reference.fps));
      if (frames) {
        carry -= (frames * 1000) / reference.fps;
        setFrameIndex((i) => (i + frames) % reference.frames.length);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [reference, playing, speed, showExample, teacher]);
  useEffect(() => {
    const v = teacherRef.current;
    if (!v) return;
    v.playbackRate = speed;
    if (playing && showExample) v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, speed, teacher, showExample, reference]);
  const stopCamera = () => {
    generation.current++;
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = undefined;
    if (videoRef.current) videoRef.current.srcObject = null;
    capture.current = null;
    setPhase("idle");
    setLive(undefined);
    setCamera("off");
  };
  useEffect(
    () => () => {
      generation.current++;
      cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && capture.current) {
        capture.current = null;
        setPhase("idle");
        setResult({
          ok: false,
          coverage: 0,
          feedback: [
            "El intento se pausó al cambiar de pestaña. Vuelve a empezar para grabar la seña completa.",
          ],
        });
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  const save = (id: string, res: Evaluation) => {
    if (!res.ok) return;
    setProgress((prev) => {
      const next = {
        ...prev,
        [id]: {
          attempts: (prev[id]?.attempts ?? 0) + 1,
          best: Math.max(prev[id]?.best ?? 0, res.score ?? 0),
          last: new Date().toISOString(),
        },
      };
      try {
        localStorage.setItem("manos-progress-v1", JSON.stringify(next));
      } catch {
        setStorageWarning(true);
      }
      return next;
    });
  };
  const enableCamera = async () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = undefined;
    capture.current = null;
    setPhase("idle");
    setLive(undefined);
    const request = ++generation.current;
    setCamera("loading");
    setError("");
    let media: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error("Camera unavailable");
      media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });
      if (request !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      media.getVideoTracks().forEach((track) =>
        track.addEventListener("ended", () => {
          if (request === generation.current) {
            generation.current++;
            cancelAnimationFrame(raf.current);
            media?.getTracks().forEach((t) => t.stop());
            if (stream.current === media) stream.current = undefined;
            if (videoRef.current && videoRef.current.srcObject === media)
              videoRef.current.srcObject = null;
            if (capture.current)
              setResult({
                ok: false,
                coverage: 0,
                feedback: [
                  "La cámara se desconectó durante el intento. Vuelve a grabar la seña completa.",
                ],
              });
            capture.current = null;
            setPhase("idle");
            setLive(undefined);
            setCamera("error");
            setError(
              "La cámara se desconectó. Conéctala y vuelve a intentarlo.",
            );
          }
        }),
      );
      const video = videoRef.current;
      if (!video)
        throw new DOMException("Camera view unavailable", "InvalidStateError");
      video.srcObject = media;
      await video.play();
      if (request !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      const models = await loadVision();
      if (request !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      setCamera("on");
      let last = 0,
        lastVideoTime = -1,
        lastFresh = performance.now();
      const tick = (now: number) => {
        if (request !== generation.current) return;
        try {
          const c = capture.current;
          if (c) {
            if (now < c.start) {
              setPhase("countdown");
              setRemaining(Math.ceil((c.start - now) / 1000));
            } else if (now < c.end) {
              setPhase("recording");
              setRemaining((c.end - now) / 1000);
            } else {
              capture.current = null;
              setPhase("idle");
              const res = evaluate(c.reference.frames, c.frames);
              if (
                !res.ok &&
                c.frames.length > 10 &&
                c.frames.filter((f) => f.p.length > 0).length >
                  c.frames.length * 0.7
              )
                res.feedback = [
                  "El seguimiento perdió las manos durante parte del movimiento. Esto puede ocurrir al cruzarlas o tapar las muñecas.",
                  "Prueba con más luz y más cerca de la cámara. También puedes comparar tu gesto con el video sin recibir una puntuación.",
                ];
              setResult(res);
              setAttempt(c.frames);
              save(c.reference.id, res);
            }
          }
          if (now - last > 65) {
            last = now;
            const fresh =
              video.readyState >= 2 &&
              !video.paused &&
              video.currentTime !== lastVideoTime;
            if (fresh) {
              lastVideoTime = video.currentTime;
              lastFresh = now;
            }
            const f = detect(video, models, now);
            if (fresh || now - lastFresh > 500) setLive(f);
            const recording = capture.current;
            if (recording && now >= recording.start && now < recording.end)
              recording.frames.push(f);
          }
          if (now - lastFresh > 5000) throw new Error("Camera stalled");
          raf.current = requestAnimationFrame(tick);
        } catch (e) {
          if (capture.current)
            setResult({
              ok: false,
              coverage: 0,
              feedback: [
                "El seguimiento se interrumpió. Vuelve a grabar la seña completa.",
              ],
            });
          capture.current = null;
          setPhase("idle");
          setCamera("error");
          setError(cameraError(e));
          setLive(undefined);
          media?.getTracks().forEach((t) => t.stop());
          if (video.srcObject === media) video.srcObject = null;
          if (stream.current === media) stream.current = undefined;
        }
      };
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      media?.getTracks().forEach((t) => t.stop());
      if (stream.current === media) stream.current = undefined;
      if (videoRef.current && videoRef.current.srcObject === media)
        videoRef.current.srcObject = null;
      if (request === generation.current) {
        setCamera("error");
        setError(cameraError(e));
      }
    }
  };
  const record = () => {
    if (!reference || camera !== "on") return;
    setResult(undefined);
    setCompare(false);
    setPlaying(false);
    const start = performance.now() + 3000;
    capture.current = {
      start,
      end: start + Math.max(4000, (reference.duration * 1000) / speed + 1000),
      frames: [],
      reference,
    };
    setPhase("countdown");
    setRemaining(3);
  };
  const seek = (n: number) => {
    setFrameIndex(n);
    setPlaying(false);
    setShowExample(true);
    if (teacherRef.current && reference) {
      teacherRef.current.pause();
      teacherRef.current.currentTime = n / reference.fps;
    }
  };
  const finish = () => {
    if (capture.current && phase === "recording")
      capture.current.end = performance.now();
  };
  const replay = () => {
    setShowExample(true);
    setFrameIndex(0);
    if (teacherRef.current) teacherRef.current.currentTime = 0;
    setPlaying(true);
  };
  const move = (next: number) => {
    capture.current = null;
    setPhase("idle");
    setIndex((next + lessons.length) % lessons.length);
  };
  const dialogue = ["0030", "0026", "0024", "0000", "0031"];
  const next = () => {
    if (mode === "conversation") {
      const p = dialogue.indexOf(lesson.id);
      move(
        lessons.findIndex((l) => l.id === dialogue[(p + 1) % dialogue.length]),
      );
    } else move(index + 1);
  };
  const changeMode = (m: Mode) => {
    setMode(m);
    if (m === "conversation") move(0);
  };
  const currentFrame = reference?.frames[frameIndex % reference.frames.length];
  const alignedIndex = result?.path?.reduce(
    (best, pair) =>
      Math.abs(pair[0] - frameIndex) < Math.abs(best[0] - frameIndex)
        ? pair
        : best,
    result.path[0],
  )?.[1];
  const comparisonFrame =
    alignedIndex !== undefined ? attempt[alignedIndex] : undefined;
  const comparisonViewport = compare
    ? sharedAvatarViewport([currentFrame, comparisonFrame])
    : undefined;
  const attempts = progress[lesson.id]?.attempts ?? 0;
  return (
    <div className="app-shell">
      <aside className="sidebar" inert={modal ? true : undefined}>
        <a className="brand" href="/" aria-label="Manos, inicio">
          <span className="brand-mark">
            <Hand size={26} />
          </span>
          manos<span className="brand-dot">.</span>
        </a>
        <div className="side-caption">APRENDE A CONECTAR</div>
        <nav aria-label="Principal">
          <button
            className={mode === "learn" ? "nav active" : "nav"}
            onClick={() => changeMode("learn")}
          >
            <BookOpen size={19} />
            Aprender<span>10</span>
          </button>
          <button
            className={mode === "practice" ? "nav active" : "nav"}
            onClick={() => changeMode("practice")}
          >
            <Hand size={19} />
            Practicar
          </button>
          <button
            className={mode === "conversation" ? "nav active" : "nav"}
            onClick={() => changeMode("conversation")}
          >
            <MessageCircle size={19} />
            Encuentro guiado
          </button>
          <button className="nav" onClick={() => openModal("progress")}>
            <ChartNoAxesColumnIncreasing size={19} />
            Mi recorrido
          </button>
        </nav>
        <div className="sidebar-note">
          <Leaf size={25} />
          <h3>
            Una nueva forma
            <br />
            de estar cerca.
          </h3>
          <p>
            Cada seña es una puerta
            <br />a otra conversación.
          </p>
          <div className="note-line" />
        </div>
        <button className="side-footer" onClick={() => openModal("about")}>
          <Info size={16} />
          Sobre este proyecto
          <ChevronRight size={14} />
        </button>
      </aside>
      <main inert={modal ? true : undefined}>
        <header className="topbar">
          <div className="crumb">
            Tu recorrido <ChevronRight size={14} />
            <span>
              {mode === "conversation" ? "Un primer encuentro" : lesson.group}
            </span>
          </div>
          <button
            aria-label={`${done} de 10 señas practicadas. Ver mi recorrido`}
            className="progress-pill"
            onClick={() => openModal("progress")}
          >
            <span className="little-leaf">
              <Leaf size={15} />
            </span>
            <strong>{done}</strong> de 10 practicadas
          </button>
        </header>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> LENGUA DE SEÑAS COLOMBIANA
            </div>
            <h1>
              {mode === "practice"
                ? "Hazlo a tu manera."
                : mode === "conversation"
                  ? "Empecemos a conversar."
                  : "Las manos también hablan."}
            </h1>
            <p>
              {mode === "practice"
                ? "Recuerda la seña, inténtala y compara tu movimiento."
                : mode === "conversation"
                  ? "Un recorrido de cinco expresiones para tu primer encuentro."
                  : "Mira con atención. Prueba sin prisa. Conecta de otra manera."}
            </p>
          </div>
          <div className="lesson-number">
            <span>LECCIÓN</span>
            <strong>
              {String(index + 1).padStart(2, "0")}
              <i>/10</i>
            </strong>
          </div>
        </section>
        {mode === "conversation" && (
          <div className="conversation-strip">
            <MessageCircle size={17} />
            <span>Encuentro guiado · expresiones aisladas</span>
            {dialogue.map((id, i) => (
              <button
                className={id === lesson.id ? "selected" : ""}
                key={id}
                onClick={() => move(lessons.findIndex((l) => l.id === id))}
              >
                {i + 1}. {lessons.find((l) => l.id === id)?.label}
              </button>
            ))}
          </div>
        )}
        <div className="lesson-grid">
          <section
            className="teacher-card"
            aria-label="Demostración de la seña"
          >
            <div className="card-heading">
              <div className="step-icon">01</div>
              <span>
                {teacher === "mirror" ? "TU MOVIMIENTO" : "OBSERVA LA SEÑA"}
              </span>
              <div className="view-toggle">
                <button
                  aria-pressed={teacher === "avatar"}
                  onClick={() => setTeacher("avatar")}
                >
                  Guía
                </button>
                <button
                  aria-pressed={teacher === "video"}
                  onClick={() => (setVideoError(false), setTeacher("video"))}
                >
                  Video LSC
                </button>
                <button
                  aria-label="Ver mi movimiento en el personaje"
                  title="Ver mi movimiento en el personaje"
                  aria-pressed={teacher === "mirror"}
                  disabled={camera !== "on"}
                  onClick={() => {
                    setTeacher("mirror");
                    setShowExample(true);
                    setCompare(false);
                  }}
                >
                  <Hand size={12} />
                </button>
              </div>
            </div>
            <div className="teacher-stage">
              <div className="sign-label">
                <h2>
                  {teacher === "mirror" ? "Tu gesto" : lesson.label}
                  <span>.</span>
                </h2>
                <p>
                  {teacher === "mirror"
                    ? "La guía sigue tus manos y postura."
                    : lesson.hint}
                </p>
              </div>
              <div className="stage-orbit orbit-one" />
              <div className="stage-orbit orbit-two" />
              {loadError ? (
                <div className="stage-message">
                  <Info />
                  <p>{loadError}</p>
                  <button onClick={() => window.location.reload()}>
                    Recargar
                  </button>
                </div>
              ) : !reference ? (
                <div className="stage-message">
                  <LoaderCircle className="spin" />
                  <p>Cargando el movimiento…</p>
                </div>
              ) : !showExample ? (
                <div className="stage-message hidden-example">
                  <Hand size={54} />
                  <h3>Ahora, de memoria.</h3>
                  <p>¿Recuerdas cómo se hace «{lesson.label}»?</p>
                  <button className="secondary" onClick={replay}>
                    <Play size={15} />
                    Ver una pista
                  </button>
                </div>
              ) : teacher === "mirror" ? (
                <div className="avatar-canvas">
                  <Avatar frame={live} />
                </div>
              ) : teacher === "avatar" ? (
                <div className="avatar-canvas">
                  <Avatar frame={currentFrame} viewport={comparisonViewport} />
                </div>
              ) : videoError ? (
                <div className="stage-message">
                  <Video />
                  <p>No se pudo cargar el video de referencia.</p>
                  <button
                    className="secondary"
                    onClick={() => setVideoError(false)}
                  >
                    Reintentar video
                  </button>
                </div>
              ) : (
                <video
                  key={lesson.id}
                  onError={() => setVideoError(true)}
                  ref={teacherRef}
                  className={"reference-video " + (zoom ? "zoomed" : "")}
                  src={`/references/${lesson.id}.mp4`}
                  playsInline
                  muted
                  loop
                  onTimeUpdate={() => {
                    if (teacherRef.current && !teacherRef.current.paused && reference)
                      setFrameIndex(
                        Math.min(
                          reference.frames.length - 1,
                          Math.floor(
                            teacherRef.current.currentTime * reference.fps,
                          ),
                        ),
                      );
                  }}
                  onLoadedMetadata={() => {
                    if (teacherRef.current) {
                      teacherRef.current.playbackRate = speed;
                      teacherRef.current.currentTime =
                        frameIndex / reference.fps;
                      if (playing)
                        teacherRef.current
                          .play()
                          .catch(() => setPlaying(false));
                    }
                  }}
                />
              )}
              {compare && teacher === "avatar" && (
                <div className="compare-legend">
                  <span />
                  Guía
                  <i />
                  Tu intento
                </div>
              )}
              {compare &&
                attempt.length > 0 &&
                showExample &&
                teacher === "avatar" && (
                  <div className="avatar-canvas">
                    <Avatar
                      ghost
                      frame={comparisonFrame}
                      viewport={comparisonViewport}
                    />
                  </div>
                )}
              {teacher === "video" && showExample && (
                <button
                  className="zoom-button"
                  aria-label={zoom ? "Ver video completo" : "Acercar video"}
                  onClick={() => setZoom(!zoom)}
                >
                  <Maximize2 size={14} />
                  {zoom ? "Completo" : "Acercar"}
                </button>
              )}
              <div className="stage-note">
                <span />
                {teacher === "mirror"
                  ? "Tu movimiento en tiempo real"
                  : teacher === "avatar"
                    ? "Movimiento de una referencia real"
                    : "Grabación original · LSC50"}
              </div>
            </div>
            {teacher === "mirror" ? (
              <div className="playback live-playback">
                <Hand size={16} />
                <span>
                  El personaje te sigue.
                  <small>Para volver al ejemplo, elige Guía o Video LSC.</small>
                </span>
              </div>
            ) : (
              <div className="playback">
                <button
                  className="icon-button"
                  aria-label={
                    playing && showExample
                      ? "Pausar demostración"
                      : "Reproducir demostración"
                  }
                  onClick={() => {
                    setShowExample(true);
                    setPlaying(!showExample || !playing);
                  }}
                  disabled={!reference}
                >
                  {playing && showExample ? (
                    <Pause size={19} />
                  ) : (
                    <Play size={19} />
                  )}
                </button>
                <button
                  className="icon-button"
                  aria-label="Repetir demostración"
                  onClick={replay}
                  disabled={!reference}
                >
                  <RotateCcw size={17} />
                </button>
                <input
                  className="timeline-slider"
                  type="range"
                  aria-label="Posición de la demostración"
                  min={0}
                  max={Math.max(1, (reference?.frames.length ?? 1) - 1)}
                  value={frameIndex}
                  onChange={(e) => seek(Number(e.target.value))}
                  disabled={!reference}
                />
                <button
                  className="speed"
                  aria-label={`Velocidad ${speed}. Cambiar velocidad`}
                  onClick={() => setSpeed(speed === 1 ? 0.5 : 1)}
                >
                  {speed === 1 ? "1×" : "0.5×"}
                  <span>{speed === 1 ? "Normal" : "Lento"}</span>
                </button>
              </div>
            )}
          </section>
          <section className="practice-card" aria-label="Tu práctica">
            <div className="card-heading">
              <div className="step-icon dark">02</div>
              <span>AHORA, TU TURNO</span>
              <span
                className={"camera-status " + (camera === "on" ? "online" : "")}
              >
                <span />
                {camera === "on"
                  ? "Cámara activa"
                  : camera === "loading"
                    ? "Preparando…"
                    : "Cámara apagada"}
              </span>
            </div>
            <div
              className={"camera-stage " + (camera === "on" ? "is-live" : "")}
            >
              <div
                className="camera-feed"
                style={{ transform: mirror ? "scaleX(-1)" : "none" }}
              >
                <video
                  ref={videoRef}
                  onError={() => {
                    const interrupted = !!capture.current;
                    stopCamera();
                    setCamera("error");
                    setError(
                      "Se interrumpió el video de la cámara. Vuelve a intentarlo.",
                    );
                    if (interrupted)
                      setResult({
                        ok: false,
                        coverage: 0,
                        feedback: [
                          "El video se interrumpió durante el intento. Vuelve a grabar la seña completa.",
                        ],
                      });
                  }}
                  muted
                  playsInline
                  className={camera === "on" ? "visible" : ""}
                />
                {camera === "on" && <LandmarkOverlay frame={live} />}
              </div>
              {camera !== "on" && (
                <div className="camera-placeholder">
                  <div className="camera-art">
                    <div className="corner tl" />
                    <div className="corner tr" />
                    <div className="corner bl" />
                    <div className="corner br" />
                    <Camera size={36} strokeWidth={1.3} />
                  </div>
                  <h3>
                    {camera === "loading"
                      ? "Preparando tu espacio…"
                      : camera === "error"
                        ? "Vamos a intentarlo de nuevo"
                        : "Aquí empieza tu práctica"}
                  </h3>
                  <p>
                    {camera === "error"
                      ? error
                      : camera === "loading"
                        ? "La primera carga puede tardar unos segundos."
                        : "Activa la cámara y deja que tus manos cuenten la historia."}
                  </p>
                  <button
                    className="primary"
                    onClick={enableCamera}
                    disabled={camera === "loading"}
                  >
                    {camera === "loading" ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <Camera size={18} />
                    )}{" "}
                    {camera === "error"
                      ? "Volver a intentar"
                      : "Activar mi cámara"}
                    {camera !== "loading" && <ArrowRight size={17} />}
                  </button>
                  {camera === "loading" && (
                    <button className="text-button" onClick={stopCamera}>
                      Cancelar
                    </button>
                  )}
                  <small>
                    <ShieldCheck size={13} />
                    El video se queda en tu navegador.
                  </small>
                </div>
              )}
              {camera === "on" && (
                <>
                  <div className="tracking-state">
                    <span className={live?.p.length ? "detected" : ""}>
                      Cuerpo {live?.p.length ? "✓" : "—"}
                    </span>
                    <span
                      className={
                        live?.l.length && live?.r.length ? "detected" : ""
                      }
                    >
                      Manos{" "}
                      {(live?.l.length ? 1 : 0) + (live?.r.length ? 1 : 0)}/2
                    </span>
                  </div>
                  <button
                    className="mirror-button"
                    aria-pressed={mirror}
                    onClick={() => setMirror(!mirror)}
                  >
                    {mirror ? "Vista espejo" : "Vista directa"}
                  </button>
                  <div className="live-hint">
                    {phase === "countdown"
                      ? "Prepárate para empezar"
                      : phase === "recording"
                        ? "Haz la seña completa"
                        : !live?.p.length
                          ? "Aléjate un poco: necesito ver tus hombros"
                          : !live.l.length || !live.r.length
                            ? "Muestra ambas manos y evita tapar las muñecas"
                            : "Cara, hombros y manos dentro del encuadre"}
                  </div>
                  <button
                    className="stop-camera"
                    onClick={stopCamera}
                    aria-label="Apagar cámara"
                  >
                    <CameraOff size={17} />
                  </button>
                  {phase === "countdown" && (
                    <div className="countdown">{remaining}</div>
                  )}
                  {phase === "recording" && (
                    <div className="recording-pill">
                      <span /> Grabando movimiento · {Math.ceil(remaining)} s
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="practice-bottom">
              {camera === "on" ? (
                <button
                  className="primary record-button"
                  disabled={!reference || phase === "countdown"}
                  onClick={phase === "recording" ? finish : record}
                >
                  {phase === "idle" ? (
                    <>
                      <Hand size={18} />
                      {result ? "Intentar de nuevo" : "Practicar esta seña"}
                      <ArrowRight size={18} />
                    </>
                  ) : phase === "countdown" ? (
                    "Prepárate…"
                  ) : (
                    "Terminar intento"
                  )}
                </button>
              ) : (
                <>
                  <span className="tip-icon">
                    <Sparkles size={16} />
                  </span>
                  <p>
                    Busca buena luz y deja espacio
                    <br />
                    para mostrar las dos manos.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
        {result && (
          <section
            className={"feedback-card " + (!result.ok ? "incomplete" : "")}
            aria-live="polite"
          >
            <div className="feedback-heading">
              <div className="feedback-icon">
                {result.ok ? (
                  <ChartNoAxesColumnIncreasing size={24} />
                ) : (
                  <Camera size={24} />
                )}
              </div>
              <div>
                <span className="eyebrow">
                  {result.ok ? "COMPARACIÓN VISUAL" : "INTENTO INCOMPLETO"}
                </span>
                <h3>
                  {result.ok
                    ? "Tu movimiento, más de cerca."
                    : "Necesito ver un poco más."}
                </h3>
              </div>
              {result.ok && (
                <div className="score">
                  <strong>{result.score}</strong>
                  <span>
                    /100
                    <br />
                    similitud estimada
                  </span>
                </div>
              )}
            </div>
            {result.metrics && (
              <div className="metrics">
                {(
                  [
                    ["shape", "Forma de la mano"],
                    ["location", "Ubicación"],
                    ["movement", "Movimiento"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <span>
                      {label}
                      <b>{result.metrics![key]}</b>
                    </span>
                    <div>
                      <i style={{ width: `${result.metrics![key]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="feedback-list">
              {result.feedback
                .filter((x) => !x.startsWith("Esta similitud visual"))
                .map((x) => (
                  <p key={x}>
                    <ArrowRight size={16} />
                    {x}
                  </p>
                ))}
            </div>
            <div className="feedback-footer">
              <small>
                Es una comparación visual, no una calificación de LSC. No evalúa
                expresión facial ni gramática.
              </small>
              {result.ok && (
                <button
                  className="text-button"
                  onClick={() => {
                    setCompare(!compare);
                    setTeacher("avatar");
                    replay();
                  }}
                >
                  {compare ? "Ocultar superposición" : "Comparar movimientos"}
                  <Maximize2 size={14} />
                </button>
              )}
              <button className="primary small" onClick={next}>
                Siguiente seña
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        )}
        <section className="lesson-footer">
          <div>
            <div className="soft-icon">
              <BookOpen size={20} />
            </div>
            <div>
              <strong>
                {attempts
                  ? `${attempts} ${attempts === 1 ? "intento" : "intentos"} en esta seña`
                  : "Aprender empieza por observar"}
              </strong>
              <p>
                {teacher === "avatar"
                  ? "Usa el video LSC para observar los detalles de manos y expresión."
                  : "Primero observa el gesto completo. Después, baja la velocidad."}
              </p>
            </div>
          </div>
          <div className="lesson-navigation">
            <button
              className="icon-button"
              onClick={() => move(index - 1)}
              aria-label="Lección anterior"
            >
              <ArrowLeft size={19} />
            </button>
            <button className="text-button" onClick={next}>
              Siguiente seña
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
        <section className="lesson-strip" aria-label="Seleccionar lección">
          {lessons.map((l, i) => (
            <button
              aria-label={`${i + 1}. ${l.label}${progress[l.id]?.attempts ? ", practicada" : ""}`}
              key={l.id}
              className={index === i ? "selected" : ""}
              onClick={() => move(i)}
            >
              <span>
                {progress[l.id]?.attempts ? (
                  <Check size={13} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              {l.label}
            </button>
          ))}
        </section>
        <footer className="page-footer">
          <span>Hecho para aprender, a tu ritmo.</span>
          <button onClick={() => openModal("about")}>
            Referencias, privacidad y alcance
            <Info size={13} />
          </button>
        </footer>
        {storageWarning && (
          <p role="status">
            El navegador no permite guardar tu progreso. Se conservará mientras
            esta página esté abierta.
          </p>
        )}
      </main>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="modal-close icon-button"
              aria-label="Cerrar"
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            {modal === "about" ? (
              <>
                <div className="eyebrow">MANOS · LSC</div>
                <h2 id="modal-title">Aprender con referencias reales.</h2>
                <p>
                  Estas diez señas provienen de{" "}
                  <a
                    href="https://doi.org/10.6084/m9.figshare.27383016.v1"
                    target="_blank"
                    rel="noreferrer"
                  >
                    LSC50
                  </a>
                  , de Flórez-Sierra y colaboradores (2024), bajo{" "}
                  <a href="https://creativecommons.org/licenses/by/4.0/">
                    CC BY 4.0
                  </a>
                  . Cada lección usa la toma 0000 del participante 0000. Los
                  videos se han comprimido y los puntos de movimiento se han
                  adaptado para animación.
                </p>
                <p>
                  La guía dibujada sigue los puntos de cuerpo y manos. Su cara
                  es estilizada: consulta el video original para ver
                  expresiones, orientación y detalles que el dibujo no
                  representa.
                </p>
                <p>
                  La comparación usa MediaPipe y una adaptación de DTW de{" "}
                  <a href="https://github.com/mhmdtaha091/SignBridge">
                    SignBridge
                  </a>{" "}
                  (MIT). Mide similitud de forma, posición y trayectoria en 2D.
                  No es una certificación de LSC, un traductor ni una evaluación
                  validada por docentes. No se evalúan gramática ni expresión
                  facial. «Encuentro guiado» encadena expresiones aisladas, no
                  interpreta una conversación libre.
                </p>
                <p>
                  La vista de cámara se muestra en espejo por defecto y puedes
                  cambiarla a vista directa. Las manos se comparan por su lado
                  anatómico; todavía no hay adaptación a otra mano dominante. La
                  cámara solo se activa cuando la solicitas. El procesamiento es
                  local; no se envía ni guarda video. Guardamos únicamente
                  intentos y mejor similitud en este navegador. La superposición
                  del último intento vive en memoria y desaparece al cambiar de
                  lección o cerrar la página.
                </p>
                <p>
                  La lengua de señas tiene variaciones regionales y personales.
                  Este material es un punto de partida para practicar junto a
                  personas sordas y docentes de LSC.
                </p>
              </>
            ) : (
              <>
                <div className="eyebrow">PASO A PASO</div>
                <h2 id="modal-title">Tu recorrido.</h2>
                <p>
                  {done} de 10 señas practicadas. Un intento registrado indica
                  práctica, no dominio de la lengua.
                </p>
                <div className="progress-list">
                  {lessons.map((l, i) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        move(i);
                        setModal(null);
                      }}
                    >
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <strong>{l.label}</strong>
                      <small>
                        {progress[l.id]?.attempts
                          ? `${progress[l.id].attempts} intentos`
                          : "Por explorar"}
                      </small>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
