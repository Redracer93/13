import {AudioBufferWithState, audioContext} from "./context";
import {Snd, snd} from "../assets/sfx";
import {fxRand} from "../utils/rnd";
import {termPrint} from "../graphics/ui";

// 0 1 2 3 4 5 6 7 8 9 10 11 12
// 0   2 3   5   7 8   10    12
const scale = [0, 2, 3, 5, 7, 8, 10];
const scalenotes = [0, 2, 3, 5, 7, 8, 10, 12, 12 + 2, 12 + 3, 12 + 5, 12 + 7, 12 + 8, 12 + 10];
//scaleNaturalMinor = {2,1,2,2,1,2,2};

const bassFilter = audioContext.createBiquadFilter();
bassFilter.connect(audioContext.destination);

const playNote = (audioBuffer: AudioBufferWithState,
                  note: number, when: number, len: number = 1, dest: AudioNode = audioContext.destination) => {
    const s = audioContext.createBufferSource();
    s.buffer = audioBuffer;
    s.detune.value = note * 100;//2 ** ((note - 12) / 12);

    s.connect(dest);
    s.start(when, 0, len);
}

let currentMusicTic = 0;
let currentBar = 0;
let musicEndTime = 0;
export const updateSong = (mainMenu: boolean) => {
    const time = audioContext.currentTime;
    //let baseBPM = mainMenu ? 90 : 110;
    let bpm = 110 + 15 * Math.sin(time / 10);
    const k = (60 / (bpm)) / 4;
    if (time >= musicEndTime) {
        musicEndTime = time + 16 * k;
        let t = 0;
        let noteStep = 0;
        let snares = fxRand(2) && !mainMenu;
        let hats = fxRand(2) && !mainMenu;
        let brk = fxRand(4) == 0 || mainMenu;
        let q =  mainMenu ? 0 : fxRand(2);
        let fq =  mainMenu ? fxRand(2000) : fxRand(10000);
        bassFilter.Q.linearRampToValueAtTime(q, time + (t + 8) * k);
        bassFilter.frequency.linearRampToValueAtTime(fq, time + (t + 8) * k)

        for (let j = 0; j < 16; ++j) {
            if (currentBar % 4 == 3) {
                if (fxRand(4) == 0 && !mainMenu) {
                    noteStep = 14 + fxRand(5);
                } else {
                    noteStep = 4 + fxRand(5);
                }
            }

            let s = scalenotes[noteStep % scalenotes.length];
            if (t % 4 == 2) {
                s = scalenotes[(noteStep + 1) % scalenotes.length];
            }
            if (t % 4 == 3) {
                s = scalenotes[(noteStep + 2) % scalenotes.length];
            }
            if (j > 12) {
                s = scalenotes[(noteStep + 1 + fxRand(5)) % scalenotes.length];
            }
            if (t % 16 < 8 || !brk) {
                playNote(snd[Snd.bass], s, time + k * t, k, bassFilter);
            }

            if (t % 4 == 0) {
                if (t % 8 == 4 && snares) {
                    playNote(snd[Snd.snare], -4, time + t * k, k * 2);
                } else {
                    playNote(snd[Snd.kick], 0, time + t * k, k * 2);
                }
            }
            if (t % 16 == 11 && fxRand(2) && snares) {
                playNote(snd[Snd.kick], 0, time + t * k, k * 2);
            }
            if ((t % 8 > 5 || t % 2 == 0) && hats) {
                playNote(snd[Snd.hat], 0, time + t * k, k);
            }

            ++t;
        }
        ++currentBar;
    }
}