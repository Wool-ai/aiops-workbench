import { initials, avatarPalette } from '../lib/data';
import styles from '../styles/Avatar.module.css';

export default function Avatar({ name, size = 20 }) {
  const pal = avatarPalette(name);
  return (
    <div
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        background: pal.bg,
        color: pal.color,
        fontSize: Math.max(9, size * 0.42),
      }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
