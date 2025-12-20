import { HTMLAttributes } from "react";
import Image from "next/image";

function LogoCloud(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props}>
      <p className="text-center">Trusted by job seekers at</p>
      <div className="my-6 flex items-center justify-center flex-wrap gap-4 [&_svg]:h-auto [&_svg]:w-24 xs:[&_svg]:w-auto xs:[&_svg]:h-8 text-muted-foreground">
        <Image alt="Infosys" src={`/company_logo/infosys.png`} height={175} width={140} />
        <Image alt="Infosys" src={`/company_logo/ibm.png`} height={175} width={140} />
        <Image alt="Infosys" src={`/company_logo/adobe.png`} height={175} width={140} />
        <Image alt="Infosys" src={`/company_logo/ntt.png`} height={175} width={140} />
        <Image alt="Infosys" src={`/company_logo/oracle.png`} height={175} width={140} />
      </div>
      <p className="text-center">This list continues to expand.</p>
    </div>
  );
}

export default LogoCloud;
