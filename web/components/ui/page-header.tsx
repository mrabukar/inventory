interface Props {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, desc, action }: Props) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc && <p className="ph-desc">{desc}</p>}
      </div>
      {action}
    </div>
  );
}
