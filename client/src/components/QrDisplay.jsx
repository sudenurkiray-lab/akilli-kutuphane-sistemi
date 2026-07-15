import { QRCodeSVG } from 'qrcode.react';

export default function QrDisplay({ value, size = 120, label, className = '' }) {
  if (!value) return null;
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="bg-white p-2 rounded-lg">
        <QRCodeSVG value={value} size={size} level="M" />
      </div>
      {label && <span className="text-xs text-gray-400 font-mono text-center break-all max-w-[140px]">{label}</span>}
    </div>
  );
}
