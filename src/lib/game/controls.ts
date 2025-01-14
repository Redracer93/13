import {inputPointers, keyboardState, KeyCode, mousePointer, Pointer} from "../utils/input";
import {draw, gl} from "../graphics/draw2d";
import {Actor} from "./types";
import {img, Img} from "../assets/gfx";
import {PAD_FIRE_RADIUS_0, PAD_FIRE_RADIUS_1, PAD_MOVE_RADIUS_0, PAD_MOVE_RADIUS_1} from "../assets/params";
import {COLOR_WHITE} from "./data/colors";
import {getScreenScale} from "./game";
import {M} from "../utils/math";

// TODO: positioning of controls
// ToDO: control zone padding should include max radius
// TODO: return mouse control
// TODO: combine pad + keyboard

export const enum ControlsFlag {
    Move = 0x1,
    Run = 0x2,
    Jump = 0x4,
    Shooting = 0x8,
    Drop = 0x10,
    Spawn = 0x20,

    MoveAngleMax = 0x40,
    MoveAngleBit = 6,
    LookAngleMax = 0x80,
    LookAngleBit = 12,
}

export const gameCamera: number[] = [0, 0, 1];
export let lookAtX = 0;
export let lookAtY = 0;
export let viewX = 0;
export let viewY = 0;
export let shootButtonDown = 0;
export let jumpButtonDown = 0;
export let moveX = 0;
export let moveY = 0;
export let moveFast = 0;
export let dropButton = 0;

export const updateControls = (player: Actor) => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    const mouse = mousePointer;

    const px = player.x_;
    const py = player.y_ - player.z_ - 10;

    if (mouse.x_ >= 0 && mouse.x_ < W && mouse.y_ >= 0 && mouse.y_ < H) {
        lookAtX = (mouse.x_ - W / 2) * gameCamera[2] + gameCamera[0];
        lookAtY = (mouse.y_ - H / 2) * gameCamera[2] + gameCamera[1];
        viewX = lookAtX - px;
        viewY = lookAtY - py;
    } else {
        viewX = 0;
        viewY = 0;
    }

    shootButtonDown = +((viewX || viewY) && mouse.active_);

    moveX = (keyboardState.has(KeyCode.D) || keyboardState.has(KeyCode.Right)) as any
        - ((keyboardState.has(KeyCode.A) || keyboardState.has(KeyCode.Left)) as any);
    moveY = (keyboardState.has(KeyCode.S) || keyboardState.has(KeyCode.Down)) as any
        - ((keyboardState.has(KeyCode.W) || keyboardState.has(KeyCode.Up)) as any);

    if (moveX || moveY) {
        moveFast = +!(keyboardState.has(KeyCode.Shift));
    }

    jumpButtonDown = +keyboardState.has(KeyCode.Space);
    dropButton = +keyboardState.has(KeyCode.E);

    {
        updateVirtualPad();
        const k = gameCamera[2];
        if (touchPadActive) {
            {
                const control = vpad[0];
                const pp = control.pointer_;
                moveX = pp ? (pp.x_ - pp.startX_) * k : 0;
                moveY = pp ? (pp.y_ - pp.startY_) * k : 0;
                const len = M.hypot(moveX, moveY);
                moveFast = +(len > control.r1_);
                jumpButtonDown = +(len > control.r2_);
            }
            {
                const control = vpad[1];
                const pp = control.pointer_;
                viewX = pp ? (pp.x_ - pp.startX_) * k : 0;
                viewY = pp ? (pp.y_ - pp.startY_) * k : 0;
                const len = M.hypot(viewX, viewY);
                lookAtX = px + viewX * 2;
                lookAtY = py + viewY * 2;
                shootButtonDown = +(len > control.r2_);
            }
            dropButton = vpad[2].pointer_ ? 1 : 0;
        }
    }

    if (mousePointer.downEvent_ && touchPadActive) {
        touchPadActive = false;
        for (const [, p] of inputPointers) {
            touchPadActive ||= p.active_;
        }
    }
}

interface VPadControl {
    l_: number;
    t_: number;
    r_: number;
    b_: number;
    flags_?: number;
    pointer_?: Pointer | undefined;
    // any len > undefined = false (undefined is NaN)
    r1_?: number | undefined;
    r2_?: number | undefined;
}

const vpad: VPadControl[] = [
    {l_: 0, t_: 0.5, r_: 0.5, b_: 1, r1_: PAD_MOVE_RADIUS_0, r2_: PAD_MOVE_RADIUS_1},
    {l_: 0.5, t_: 0.5, r_: 1, b_: 1, r1_: PAD_FIRE_RADIUS_0, r2_: PAD_FIRE_RADIUS_1},
    {l_: 0.5, t_: 0, r_: 1, b_: 0.5, flags_: 1},
];
let touchPadActive = false;

const checkPointerIsAvailableForCapturing = (pointer: Pointer) =>
    !vpad.some(c => c.pointer_ == pointer);

const testZone = (control: VPadControl, rx: number, ry: number) =>
    rx > control.l_ && rx < control.r_ && ry > control.t_ && ry < control.b_;

const updateVirtualPad = () => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    for (const control of vpad) {
        // if not captured
        if (!control.pointer_) {
            // capture
            for (const [, p] of inputPointers) {
                if (p.downEvent_ &&
                    testZone(control, p.startX_ / W, p.startY_ / H) &&
                    checkPointerIsAvailableForCapturing(p)) {
                    control.pointer_ = p;
                }
            }
        }
        // if captured
        if (control.pointer_) {
            const p = control.pointer_;
            let release = !p.active_;
            // out-of-zone mode
            if (control.flags_ & 1) {
                release ||= !testZone(control, p.x_ / W, p.y_ / H);
            }
            if (release) {
                // release
                control.pointer_ = undefined;
            } else {
                touchPadActive = true;
            }
        }
    }
}

export const drawVirtualPad = () => {
    if (!touchPadActive) {
        return;
    }
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const k = 1 / getScreenScale();
    let i = 0;
    for (const control of vpad) {
        const w_ = W * (control.r_ - control.l_);
        const h_ = H * (control.b_ - control.t_);
        let cx = k * (W * control.l_ + w_ / 2);
        let cy = k * (H * control.t_ + h_ / 2);
        // draw(img[Img.box], cx, cy, 0, w_ * k, h_ * k, 0.1, 0);
        const pp = control.pointer_;
        if (!(control.flags_ & 1) && pp) {
            cx = pp.startX_ * k;
            cy = pp.startY_ * k;
            draw(img[Img.circle_16], pp.x_ * k, pp.y_ * k, 0, 1, 1, 0.5);
        }
        draw(img[Img.joy0 + i], cx, cy, 0, 1, 1, 0.5, pp ? COLOR_WHITE : 0);
        ++i;
    }
}
