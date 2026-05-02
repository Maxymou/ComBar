
interface HeaderProps {
  isHH: boolean;
  onToggleHH: () => void;
  onOpenMenu: () => void;
}

export default function Header({
  isHH,
  onToggleHH,
  onOpenMenu,
}: HeaderProps) {

  return (
    <div className="header-wrap">
      <div className="header">
        <div className="header-left">
          <button className="title title-btn btn-reset-style" onClick={onOpenMenu} type="button" aria-label="Ouvrir le menu">
            <img src="/logo-192.png" alt="ComBar" className="header-logo" />
            {isHH && <span className="hh-flash">HH</span>}
          </button>
        </div>
        <div className="header-right">
          <button className="btn-hh" onClick={onToggleHH}>
            {isHH ? 'HH ON' : 'Happy Hour'}
          </button>
        </div>
      </div>
    </div>
  );
}
