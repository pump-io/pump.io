Vagrant.configure("2") do |config|
  config.vm.define :dev do |dev_config|
    dev_config.vm.box = "precise64"
    dev_config.vm.box_url = "http://files.vagrantup.com/precise64.box"
    dev_config.vm.provision :shell, :inline => "su -c '/vagrant/vagrantfiles/install.sh' vagrant"
    dev_config.vm.network :forwarded_port, host: 8000, guest: 8000
    dev_config.vm.provider :virtualbox do |vb|
      vb.customize [ "modifyvm", :id, "--memory", 1024]
    end
  end
end