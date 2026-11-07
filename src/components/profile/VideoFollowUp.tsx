import {
  ChevronDown,
  Mic,
  MicOff,
  PhoneOff,
  Speaker,
  Video,
  VideoOff,
} from "lucide-react";
import { useState } from "react";
import type { Patient } from "../../types";
import nurseSelfImg from "../../assets/video/nurse-self.webp";
import robertBirdImg from "../../assets/video/robert-bird.webp";

// Sample camera frames for patients that have them: the patient's feed and the nurse's own preview.
const CAMERA_IMAGES: Record<string, { patient: string; self: string }> = {
  "robert-bird": { patient: robertBirdImg, self: nurseSelfImg },
};

// Sample device names for the demo. Nothing here detects or switches real hardware.
const DEVICES = {
  mic: ["Default", "Headset (sample)", "USB mic (sample)"],
  speaker: ["Default", "Headset (sample)", "External (sample)"],
  camera: ["Default", "USB camera (sample)"],
} as const;

const NURSE_INITIALS = "KR";

/**
 * Simulated video follow-up: a static stage with mute, camera and end controls driven by local
 * state. It never opens a connection or touches the microphone or camera.
 */
export function VideoFollowUp({ p }: { p: Patient }) {
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [mic, setMic] = useState<string>(DEVICES.mic[0]);
  const [speaker, setSpeaker] = useState<string>(DEVICES.speaker[0]);
  const [camera, setCamera] = useState<string>(DEVICES.camera[0]);
  const initials = p.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const landline = p.contactMethod === "phone";
  const cams = CAMERA_IMAGES[p.id];

  return (
    <section
      aria-labelledby="pw-video-title"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="pw-video-title" className="pw-region-title">
          Video follow-up
        </h2>
        <span className="text-[12px] text-muted" aria-live="polite">
          {ended ? "Session ended" : "Connected"}
        </span>
      </div>

      <div className="pw-video-stage">
        {ended ? (
          <div className="grid h-full place-items-center p-3 text-center">
            <div>
              <p className="text-[13px] font-medium text-white/85">
                Session ended
              </p>
              <button
                type="button"
                onClick={() => {
                  setEnded(false);
                  setMuted(false);
                  setCamOff(false);
                }}
                className="mt-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-[#a8c7fa] hover:bg-white/10"
              >
                Start a new simulated session
              </button>
            </div>
          </div>
        ) : (
          <>
            {cams ? (
              <img
                src={cams.patient}
                alt={`${p.name} on camera`}
                className="absolute inset-0 size-full rounded-[inherit] object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center pb-6">
                <span className="grid size-12 place-items-center rounded-full bg-[#5f6368] text-[18px] font-semibold text-white">
                  {initials}
                </span>
              </div>
            )}
            {/* Local preview */}
            <div className="absolute top-2 right-2 grid aspect-video w-[26%] min-w-[64px] place-items-center overflow-hidden rounded-[8px] bg-[#3c4043]">
              {camOff ? (
                <VideoOff
                  className="size-4 text-white/70"
                  aria-label="Your camera is off"
                />
              ) : cams ? (
                <img
                  src={cams.self}
                  alt="Your camera"
                  className="absolute inset-0 size-full object-cover object-[50%_35%]"
                />
              ) : (
                <span className="grid size-6 place-items-center rounded-full bg-[#5e7a8a] text-[10px] font-semibold text-white">
                  {NURSE_INITIALS}
                </span>
              )}
              <span className="absolute bottom-0.5 left-1.5 text-[10px] text-white/85 [text-shadow:0_1px_2px_rgb(0_0_0/0.7)]">
                You
              </span>
              {muted ? (
                <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-[#f9dedc]">
                  <MicOff
                    className="size-2.5 text-[#8c1d18]"
                    aria-label="You are muted"
                  />
                </span>
              ) : null}
            </div>
            <span className="absolute bottom-3 left-3 max-w-[45%] truncate text-[12.5px] font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.7)]">
              {p.name}
              {landline ? (
                <span className="text-white/60"> · landline</span>
              ) : null}
            </span>
          </>
        )}

        <div
          className="absolute right-2 bottom-2 flex gap-1.5"
          role="group"
          aria-label="Call controls"
        >
          <button
            type="button"
            className="pw-call-btn"
            aria-pressed={muted}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            title={muted ? "Unmute" : "Mute"}
            disabled={ended}
            onClick={() => setMuted((v) => !v)}
          >
            {muted ? (
              <MicOff className="size-4" aria-hidden="true" />
            ) : (
              <Mic className="size-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="pw-call-btn"
            aria-pressed={camOff}
            aria-label={camOff ? "Turn camera on" : "Turn camera off"}
            title={camOff ? "Camera on" : "Camera off"}
            disabled={ended}
            onClick={() => setCamOff((v) => !v)}
          >
            {camOff ? (
              <VideoOff className="size-4" aria-hidden="true" />
            ) : (
              <Video className="size-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="pw-call-btn pw-call-end"
            aria-label="End simulated session"
            title="End"
            disabled={ended}
            onClick={() => setEnded(true)}
          >
            <PhoneOff className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="mt-2 flex gap-1.5"
        role="group"
        aria-label="Audio and video devices (sample)"
      >
        <DeviceSelect
          label="Microphone"
          icon={Mic}
          value={mic}
          options={DEVICES.mic}
          onChange={setMic}
        />
        <DeviceSelect
          label="Speakers"
          icon={Speaker}
          value={speaker}
          options={DEVICES.speaker}
          onChange={setSpeaker}
        />
        <DeviceSelect
          label="Camera"
          icon={Video}
          value={camera}
          options={DEVICES.camera}
          onChange={setCamera}
        />
      </div>
    </section>
  );
}

function DeviceSelect({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: typeof Mic;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="pw-device" title={`${label}: ${value}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5 text-muted"
        aria-hidden="true"
      />
    </label>
  );
}
