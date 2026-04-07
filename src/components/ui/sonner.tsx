import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      expand={true}
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-border group-[.toaster]:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] group-[.toaster]:rounded-2xl group-[.toaster]:font-bold group-[.toaster]:p-6 group-[.toaster]:gap-4 group-[.toaster]:overflow-hidden group-[.toaster]:relative",
          description: "group-[.toast]:text-slate-500 font-semibold text-xs",
          actionButton: "group-[.toast]:bg-slate-900 group-[.toast]:text-white font-black rounded-xl px-4 py-2 transition-transform active:scale-95",
          cancelButton: "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500 font-bold rounded-xl px-4 py-2",
          success: "group-[.toast]:border-l-4 group-[.toast]:border-l-emerald-500 group-[.toast]:bg-emerald-50/10",
          error: "group-[.toast]:border-l-4 group-[.toast]:border-l-red-500 group-[.toast]:bg-red-50/10",
          info: "group-[.toast]:border-l-4 group-[.toast]:border-l-blue-500 group-[.toast]:bg-blue-50/10",
          warning: "group-[.toast]:border-l-4 group-[.toast]:border-l-amber-500 group-[.toast]:bg-amber-50/10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
