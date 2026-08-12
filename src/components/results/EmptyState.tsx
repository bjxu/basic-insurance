type Props = {
  message: string;
};

export function EmptyState({ message }: Props) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-10 text-center text-on-surface-variant">
      <p className="text-[15px] mb-1.5">Keine Angebote gefunden</p>
      <p className="text-body-small text-outline">{message}</p>
    </div>
  );
}
