type Props = {
  message: string;
};

export function EmptyState({ message }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
      <p className="text-[15px] mb-1.5">Keine Angebote gefunden</p>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
