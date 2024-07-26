class Bbai < Formula
  desc "Be Better at ... Everything You Do with Text"
  homepage "https://github.com/BBai-Tips/bbai"
  url "https://github.com/BBai-Tips/bbai/archive/v0.0.2-alpha.tar.gz"
  sha256 "REPLACE_WITH_ACTUAL_SHA256"
  license "MIT"

  depends_on "deno"
  depends_on "git"
  depends_on "universal-ctags" => :recommended

  def install
    system "deno", "task", "build"
    bin.install "bbai"
    bin.install "bbai-api"
  end

  test do
    assert_match "BBai CLI", shell_output("#{bin}/bbai --help")
    assert_match "BBai API", shell_output("#{bin}/bbai-api --help")
  end
end
