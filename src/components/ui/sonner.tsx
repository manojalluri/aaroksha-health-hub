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
      gap={0}
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-100 group-[.toaster]:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.1)] group-[.toaster]:rounded-xl group-[.toaster]:font-bold group-[.toaster]:p-4 group-[.toaster]:gap-3 group-[.toaster]:overflow-hidden",
          description: "group-[.toast]:text-slate-500 font-semibold text-[10px]",
          actionButton: "group-[.toast]:bg-blue-600 group-[.toast]:text-white font-black rounded-xl px-4 py-2 transition-transform active:scale-95",
          cancelButton: "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500 font-bold rounded-xl px-4 py-2",
          success: "group-[.toast]:border-l-4 group-[.toast]:border-l-green-600 group-[.toast]:bg-green-50/30",
          error: "group-[.toast]:border-l-4 group-[.toast]:border-l-red-600 group-[.toast]:bg-red-50/30",
          info: "group-[.toast]:border-l-4 group-[.toast]:border-l-blue-600 group-[.toast]:bg-blue-50/30",
          warning: "group-[.toast]:border-l-4 group-[.toast]:border-l-amber-500 group-[.toast]:bg-amber-50/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
