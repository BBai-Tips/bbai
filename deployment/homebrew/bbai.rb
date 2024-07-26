class BBai < Formula
  desc "Be Better at ... Everything You Do with Text"
  homepage "https://github.com/BBai-Tips/bbai"
  url "https://github.com/BBai-Tips/bbai/archive/vVERSION_PLACEHOLDER.tar.gz"
  sha256 "SHA256_PLACEHOLDER"
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
