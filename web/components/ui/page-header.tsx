interface Props {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, desc, action, className }: Props) {
  return (
    <div className={`page-head${className ? ` ${className}` : ""}`}>
      <div>
        <h1>{title}</h1>
        {desc && <p className="ph-desc">{desc}</p>}
      </div>
      {action}
    </div>
  );
}
