import * as Dialog from "@radix-ui/react-dialog";
import { CHARGES, DAMAGE, LOW_HP, MAX_HP, RANGE, THROW_RANGE } from "@/lib/rules";
import styles from "./Rules.module.css";

export function Rules({ label = "How to play" }: { label?: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="btn ghost">{label}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title>How to play</Dialog.Title>
          <Dialog.Description>Find a key, reach the chest, and stay out of range.</Dialog.Description>
          <ul>
            <li><b>Your turn:</b> roll the die. The number is your move points. Select a highlighted tile to step there, to any of the six neighbouring hexagons. Each tile shows its cost.</li>
            <li><b>Cost:</b> land 1. Water 2, or 1 once you have a ship. Visit a harbour to get a ship. You can always take at least one step.</li>
            <li><b>Pick-ups:</b> keys, weapons and the eyepatch are collected just by passing over them. The chart is 17 × 20 hexagons; use Zoom in to see your surroundings.</li>
            <li><b>Win:</b> step on the treasure chest while carrying a key. There is one key fewer than there are pirates.</li>
            <li><b>Weapons</b> cost 1 move point per use: sword {RANGE.sword} tile ({CHARGES.sword} shots), pistol {RANGE.pistol} ({CHARGES.pistol}), cannon {RANGE.cannon} ({CHARGES.cannon}). Damage: sword {DAMAGE.sword}, pistol {DAMAGE.pistol}, cannon {DAMAGE.cannon}. A used-up weapon returns to the tile it was found on, marked by a faint shadow.</li>
            <li><b>Health:</b> every pirate has {MAX_HP}. At {LOW_HP} or less you are wounded and every step costs double.</li>
            <li><b>Knocked out:</b> at 0 health you miss your next turn and wake with full health. Once the turn of whoever hit you ends, you hurl any key you carry to a tile up to {THROW_RANGE} away, then the game goes on.</li>
            <li><b>Eyepatch</b> costs 1 move point to put on, then halves the cost of your next {CHARGES.eyepatch} steps.</li>
          </ul>
          <Dialog.Close asChild><button className="btn">Got it</button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
