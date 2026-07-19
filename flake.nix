{
  description = "TokenTopper Professional AI Usage Index CLI";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        in
        {
          default = pkgs.buildNpmPackage {
            pname = "tokentopper";
            inherit (packageJson) version;
            src = ./.;

            nodejs = pkgs.nodejs_24;
            npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
            npmConfigHook = pkgs.importNpmLock.npmConfigHook;

            meta = {
              description = "Professional AI Usage Index for Claude Code, Codex, and OpenCode";
              homepage = "https://openfactoryai.com/tools/tokentopper/";
              license = pkgs.lib.licenses.mit;
              mainProgram = "tokentopper";
              platforms = pkgs.lib.platforms.unix;
            };
          };
        });

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/tokentopper";
        };
      });
    };
}
