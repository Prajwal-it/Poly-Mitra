import { Link } from "react-router-dom";
import SiteLayout from "../components/SiteLayout";
import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <SiteLayout>
      <div className="min-h-[60vh] grid place-items-center px-4 py-20">
        <div className="text-center max-w-md">
          <p className="font-display text-7xl font-extrabold text-brand">404</p>
          <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="mt-6"><Link to="/"><Button>Go home</Button></Link></div>
        </div>
      </div>
    </SiteLayout>
  );
}
