import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Myna UI Icons (MIT): https://www.shadcn.io/icon/mynaui-thermometer */
export function MynauiThermometer(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.155 13.86a.3.3 0 0 1-.114-.116.3.3 0 0 1-.041-.155v-8.66c0-.512-.21-1.002-.586-1.364A2.04 2.04 0 0 0 12 3c-.53 0-1.04.203-1.414.565A1.9 1.9 0 0 0 10 4.929v8.66a.3.3 0 0 1-.041.155.3.3 0 0 1-.114.116 3.97 3.97 0 0 0-1.396 1.493A3.8 3.8 0 0 0 8.004 17.3a3.8 3.8 0 0 0 1.266 2.644 4.1 4.1 0 0 0 2.82 1.037 4.07 4.07 0 0 0 2.77-1.16A3.8 3.8 0 0 0 16 17.145c0-.652-.168-1.294-.49-1.867a4 4 0 0 0-1.355-1.417Z" />
    </svg>
  );
}

/** Myna UI Icons (MIT): https://www.shadcn.io/icon/mynaui-mask */
export function MynauiMask(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5.7 8.77 5.175-1.517a4 4 0 0 1 2.25 0L18.3 8.769m-12.6 0V7.35a1.35 1.35 0 0 0-2.7 0v2.188a2 2 0 0 0 2 2h.7m0-2.769v2.77m12.6-2.77v2.77m0-2.77V7.35a1.35 1.35 0 1 1 2.7 0v2.188a2 2 0 0 1-2 2h-.7m0 0v.162a6.3 6.3 0 1 1-12.6 0v-.161" />
    </svg>
  );
}

/** Myna UI Icons (MIT): https://www.shadcn.io/icon/mynaui-cloud-rain */
export function MynauiCloudRain(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12.004 19 12 14m4.004 7L16 16m-7.996 1L8 12m11.825 5c4.495-3.16.475-7.73-3.706-7.73C13.296 7.268-3.265 7.368 4.074 15.662" />
    </svg>
  );
}
