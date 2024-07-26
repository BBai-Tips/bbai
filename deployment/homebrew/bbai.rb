class Bbai < Formula
  desc "Be Better at ... Everything You Do with Text"
  homepage "https://github.com/BBai-Tips/bbai"
  url "https://github.com/BBai-Tips/bbai/archive/v0.0.2-alpha.tar.gz"
  sha256 "8baae0b908b58913971799919f1572c8cf3a0caaf12c74a24c1745c6a8abb9a2"
  license "MIT"

  depends_on "deno"
  depends_on "git"
  depends_on "universal-ctags" => :recommended

  def install
    system "deno", "task", "build"
    bin.install "build/bbai"
    bin.install "build/bbai-api"
  end

  test do
    assert_match "BBai CLI", shell_output("#{bin}/bbai --help")
    assert_match "BBai API", shell_output("#{bin}/bbai-api --help")
  end
end
