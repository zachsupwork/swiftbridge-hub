import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Home, ArrowLeftRight, TrendingUp, HelpCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <Helmet>
        <title>Page Not Found | Crypto DeFi Bridge</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <h1 className="mb-4 text-6xl font-bold text-foreground">404</h1>
          <p className="mb-6 text-xl text-muted-foreground">
            This page doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
            <Link
              to="/earn"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Earn
            </Link>
            <Link
              to="/support"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              Support
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;
