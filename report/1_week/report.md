# setting

## sample search
> modsecurity docker image [link](https://hub.docker.com/r/owasp/modsecurity/tags)
> nginx docker image는 필요가 없는 것 같다.
> 이미 modsecurity에 포함이 되어 있음
```sh
docker pull owasp/modsecurity:nginx
```


## setting modsecurity's rules, crs..
```sh
git clone https://github.com/coreruleset/coreruleset.git
cp -r coreruleset/crs-setup.conf.example nginx/modsecurity/crs-setup.conf
cp -r coreruleset/rules nginx/modsecurity/rules
```

