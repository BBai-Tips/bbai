class Bbai < Formula
  desc "Be Better at ... Everything You Do with Text"
  version "0.0.3-alpha"
  url "https://github.com/BBai-Tips/bbai/archive/v0.0.3-alpha.tar.gz"
  sha256 "df50cc136db0c25631d4e779940031135c59468455ba0ac79e14e40b6fd22be3"
  homepage "https://github.com/BBai-Tips/bbai"
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
